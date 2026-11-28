import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(
  new URL('../scripts/check-published-content.mjs', import.meta.url),
);

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'desk-publication-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const options = { cwd: directory, encoding: 'utf8' };
  const git = (...args) => execFileSync('git', args, options).trim();
  git('init', '--quiet');

  return {
    write(path, text) {
      const file = join(directory, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    },
    move(from, to) {
      const destination = join(directory, to);
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(directory, from), destination);
    },
    remove(path) {
      unlinkSync(join(directory, path));
    },
    commit() {
      git('add', '--all');
      git(
        '-c',
        'user.name=Desk Test',
        '-c',
        'user.email=desk-test@example.com',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '-m',
        'Fixture',
      );
      return git('rev-parse', 'HEAD');
    },
    check(base) {
      const result = spawnSync(process.execPath, [script, base], options);
      assert.ifError(result.error);
      return result;
    },
  };
}

test('Markdown in a retired Blog directory cannot pass unpublished', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  let base = repo.commit();
  for (const [folder, destination] of [
    ['posts', 'content/blog/'],
    ['topics', 'content/blog/topics/'],
  ]) {
    const file = `content/${folder}/example.md`;
    repo.write(file, '# Example\n');
    const revision = repo.commit();
    const result = repo.check(base);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`Move ${file} to ${destination}`));
    base = revision;
  }
});

test('a renamed post requires its previous route even when the new page exists', (t) => {
  const repo = fixture(t);
  repo.write('content/posts/original.md', '# Example\n');
  const base = repo.commit();
  repo.move('content/posts/original.md', 'content/blog/research/renamed.md');
  repo.commit();
  repo.write('dist/posts/renamed/index.html', '<h1>Example</h1>');
  const result = repo.check(base);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must preserve \/posts\/original\//);
  repo.write('dist/posts/original/index.html', '<h1>Existing route</h1>');
  const preserved = repo.check(base);
  assert.equal(preserved.status, 0, preserved.stderr);
});

test('a move into assets still requires the original published route', (t) => {
  const repo = fixture(t);
  repo.write('content/blog/original.md', '# Example\n');
  const base = repo.commit();
  repo.move('content/blog/original.md', 'content/blog/assets/original.md');
  repo.commit();
  const result = repo.check(base);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must preserve \/posts\/original\//);
});

test('GitHub project references require a page in the GitHub library', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/github/workflow.md', '# Workflow\n');
  repo.write(
    'content/github/topics/workflows.md',
    '---\ntitle: Workflows\n---\n',
  );
  repo.commit();
  repo.write('dist/posts/workflow/index.html', '<h1>Blog</h1>');
  const missing = repo.check(base);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /content\/github\/workflow\.md::This entry has no published page/,
  );
  repo.write('dist/github/workflow/index.html', '<h1>Workflow</h1>');
  const published = repo.check(base);
  assert.equal(published.status, 0, published.stderr);
});

test('a GitHub project cannot take the topic index URL', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/github/topics.md', '# Topics\n');
  repo.commit();
  repo.write('dist/github/topics/index.html', '<h1>Topics</h1>');
  const result = repo.check(base);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GitHub reserves the slug "topics"/);
});

test('topic definitions in both catalogs must use a flat, lowercase Markdown path', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  for (const folder of ['content/github/topics', 'content/blog/topics']) {
    for (const entry of ['nested/workflows.md', 'workflows.MD']) {
      const file = `${folder}/${entry}`;
      repo.write(file, '# Workflows\n');
      repo.commit();
      const result = repo.check(base);
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(`Found ${entry}`), result.stderr);
      repo.remove(file);
    }
  }
});

test('a changed brief without a built page fails the publication check', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/briefs/2026/11/2026-11-18.md', '# Daily issue\n');
  repo.commit();
  const result = repo.check(base);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /2026-11-18\.md::This entry has no published page\. Check its filename and route\./,
  );
});

test('paper notes require built pages and retain their original URLs on rename', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/papers/reading-note.md', '# Reading note\n');
  const original = repo.commit();
  const missing = repo.check(base);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /reading-note\.md::This entry has no published page/,
  );

  repo.write('dist/papers/reading-note/index.html', '<h1>Reading note</h1>');
  const published = repo.check(base);
  assert.equal(published.status, 0, published.stderr);

  repo.move('content/papers/reading-note.md', 'content/papers/renamed.md');
  repo.commit();
  repo.remove('dist/papers/reading-note/index.html');
  repo.write('dist/papers/renamed/index.html', '<h1>Reading note</h1>');
  const renamed = repo.check(original);
  assert.equal(renamed.status, 1);
  assert.match(renamed.stderr, /must preserve \/papers\/reading-note\//);
});

test('prompt collections require built pages at their stable URLs', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/prompts/decision-making.md', '# Decisions\n');
  repo.commit();

  const missing = repo.check(base);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /decision-making\.md::This entry has no published page/,
  );

  repo.write('dist/prompts/decision-making/index.html', '<h1>Decisions</h1>');
  const published = repo.check(base);
  assert.equal(published.status, 0, published.stderr);
});

test('uppercase Markdown extensions outside assets fail validation', (t) => {
  const repo = fixture(t);
  repo.write('README.md', '# Desk\n');
  const base = repo.commit();
  repo.write('content/blog/research/example.MD', '# Example\n');
  repo.commit();
  repo.write('dist/posts/example/index.html', '<h1>Example</h1>');
  const result = repo.check(base);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Found research\/example\.MD/);
});

test('correcting an invalid source extension only requires the new route', (t) => {
  const repo = fixture(t);
  repo.write('content/blog/example.MD', '# Example\n');
  const base = repo.commit();
  repo.move('content/blog/example.MD', 'content/blog/research/example.md');
  repo.commit();
  repo.write('dist/posts/example/index.html', '<h1>Example</h1>');
  const result = repo.check(base);
  assert.equal(result.status, 0, result.stderr);
});

test('a deletion and Markdown assets remain outside the publication gate', (t) => {
  const repo = fixture(t);
  repo.write('content/blog/retired.md', '# Retired\n');
  const base = repo.commit();
  repo.remove('content/blog/retired.md');
  repo.write('content/blog/research/assets/example/credits.MD', '# Credits\n');
  repo.write('content/briefs/2026/11/assets/example/credits.MD', '# Credits\n');
  repo.commit();
  const result = repo.check(base);
  assert.equal(result.status, 0, result.stderr);
});
