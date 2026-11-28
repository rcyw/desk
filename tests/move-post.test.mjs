import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const slug = 'sample-note';
const target = `engineering/${slug}.md`;
const source = `${slug}.md`;
const sourceAsset = `assets/${slug}/chart.png`;
const targetAsset = `engineering/${sourceAsset}`;
const lock = `.move-post-${slug}`;
const original =
  '---\r\ntitle: Samples\r\n---\r\n![](./assets/sample-note/chart.png)\r\n';

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'desk-move-post-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['scripts/move-post.mjs', 'src/lib/content-paths.ts']) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(new URL(`../${file}`, import.meta.url), target);
  }
  const post = (path) => join(root, 'content/blog', path);
  mkdirSync(dirname(post(sourceAsset)), { recursive: true });
  writeFileSync(post(source), original);
  writeFileSync(post(sourceAsset), 'chart');
  const entry = join(root, 'scripts/move-post.mjs');
  return {
    read: (path) => readFileSync(post(path), 'utf8'),
    exists: (path) => existsSync(post(path)),
    run(options = {}) {
      const args = [];
      if (options.onRename) {
        const hook = join(root, 'hook.mjs');
        writeFileSync(
          hook,
          `
          import fs from 'node:fs';
          import { syncBuiltinESMExports } from 'node:module';
          const rename = fs.renameSync;
          fs.renameSync = (from, to) => {
            rename(from, to);
            if (from === ${JSON.stringify(dirname(post(sourceAsset)))}) {
              ${options.onRename}
            }
          };
          syncBuiltinESMExports();
        `,
        );
        args.push('--import', pathToFileURL(hook).href);
      }
      args.push(entry, slug, 'engineering');
      if (options.apply) args.push('--apply');
      const result = spawnSync(process.execPath, args, {
        encoding: 'utf8',
        timeout: 10_000,
        killSignal: 'SIGKILL',
      });
      assert.ifError(result.error);
      return result;
    },
  };
}

test('moves an article and its assets with their contents unchanged', (t) => {
  const repo = fixture(t);
  const preview = repo.run();
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Dry run/);
  assert.equal(repo.read(source), original);
  assert.equal(repo.exists(target), false);

  const applied = repo.run({ apply: true });
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(repo.read(target), original);
  assert.equal(repo.read(targetAsset), 'chart');
  for (const path of [source, sourceAsset, lock]) {
    assert.equal(repo.exists(path), false, path);
  }
});

test('rolls back the move when another writer changes the source', (t) => {
  const repo = fixture(t);
  const result = repo.run({
    apply: true,
    onRename: `fs.appendFileSync(new URL('./content/blog/${source}', import.meta.url), 'edited');`,
  });

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /changed during the move/);
  assert.equal(repo.read(source), original + 'edited');
  assert.equal(repo.read(sourceAsset), 'chart');
  for (const path of [target, targetAsset, lock]) {
    assert.equal(repo.exists(path), false, path);
  }
});

for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  test(
    `releases the move lock after ${signal}`,
    { skip: process.platform === 'win32' },
    (t) => {
      const repo = fixture(t);
      const result = repo.run({
        apply: true,
        onRename: `process.kill(process.pid, '${signal}');`,
      });

      assert.equal(result.status, exitCode, result.stderr);
      assert.equal(repo.read(target), original);
      assert.equal(repo.read(targetAsset), 'chart');
      assert.equal(repo.exists(source), false);
      assert.equal(repo.exists(lock), false);
    },
  );
}
