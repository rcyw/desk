import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const project = new URL('../', import.meta.url);
const fixtures = new URL('fixtures/content/', import.meta.url);
const run = promisify(execFile);

test('published content and drafts in a production build', { timeout: 60_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'desk-content-'));
  const root = pathToFileURL(`${directory}${sep}`);
  t.after(() => rm(root, { recursive: true, force: true }));

  const projectFiles = ['astro.config.mjs', 'package.json', 'tsconfig.json', 'src', 'public'];
  const dependencies = fileURLToPath(new URL('node_modules', project));
  const caches = new Set([join(dependencies, '.astro'), join(dependencies, '.vite')]);
  await Promise.all([
    ...projectFiles.map((path) => cp(new URL(path, project), new URL(path, root), { recursive: true })),
    cp(fixtures, new URL('content', root), { recursive: true }),
    // Keep pnpm's relative links while giving Astro a dependency tree under the test root.
    cp(dependencies, new URL('node_modules', root), {
      recursive: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
      filter: (source) => !caches.has(source),
    }),
  ]);

  const require = createRequire(new URL('package.json', root));
  const astroPackage = pathToFileURL(require.resolve('astro/package.json'));
  const { bin } = JSON.parse(await readFile(astroPackage, 'utf8'));
  const astroCli = fileURLToPath(new URL(bin.astro, astroPackage));
  await run(process.execPath, [astroCli, 'build'], { cwd: directory, timeout: 40_000 });

  const { preview } = await import(pathToFileURL(require.resolve('astro')).href);
  const server = await preview({
    root: directory,
    logLevel: 'warn',
    server: { host: '127.0.0.1', port: 0 },
  });
  const origin = `http://127.0.0.1:${server.port}`;
  const articlePath = '/posts/published-note/';
  const topicPath = '/topics/research/';

  async function readPage(path, status = 200) {
    const response = await fetch(new URL(path, origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });
    const html = await response.text();
    assert.equal(response.status, status, `${path} should return HTTP ${status}`);
    return html;
  }

  try {
    const [home, topics, topic, article] = await Promise.all([
      readPage('/'),
      readPage('/topics/'),
      readPage(topicPath),
      readPage(articlePath),
    ]);

    await t.test('the homepage links to a directly accessible article', () => {
      assert.ok(home.includes(`href="${articlePath}"`));
      assert.match(article, /<h1 id="article-title">阅读 Open Source<\/h1>/);
      assert.match(article, /这篇笔记用于验证独立阅读页。/);
    });

    await t.test('the topic index, topic page, and article link to each other', () => {
      assert.ok(topics.includes(`href="${topicPath}"`));
      assert.ok(topic.includes(`href="${articlePath}"`));
      assert.ok(article.includes(`href="${topicPath}"`));
    });

    await t.test('draft articles and draft-only topics are excluded', async () => {
      for (const html of [home, topics, topic, article]) {
        assert.doesNotMatch(html, /Draft Note|Draft Only|\/posts\/draft-note\/|\/topics\/draft-only\//);
      }
      await Promise.all([
        readPage('/posts/draft-note/', 404),
        readPage('/topics/draft-only/', 404),
      ]);
    });
  } finally {
    await server.stop();
  }
});
