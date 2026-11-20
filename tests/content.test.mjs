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

test(
  'published content and drafts in a production build',
  { timeout: 60_000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'desk-content-'));
    const root = pathToFileURL(`${directory}${sep}`);
    t.after(() => rm(root, { recursive: true, force: true }));

    const projectFiles = [
      'astro.config.mjs',
      'package.json',
      'tsconfig.json',
      'src',
      'public',
    ];
    const dependencies = fileURLToPath(new URL('node_modules', project));
    const caches = new Set([
      join(dependencies, '.astro'),
      join(dependencies, '.vite'),
    ]);
    await Promise.all([
      ...projectFiles.map((path) =>
        cp(new URL(path, project), new URL(path, root), { recursive: true }),
      ),
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
    await run(process.execPath, [astroCli, 'build'], {
      cwd: directory,
      timeout: 40_000,
    });

    const { preview } = await import(
      pathToFileURL(require.resolve('astro')).href
    );
    const server = await preview({
      root: directory,
      logLevel: 'warn',
      server: { host: '127.0.0.1', port: 0 },
    });
    const origin = `http://127.0.0.1:${server.port}`;
    const articlePath = '/posts/published-note/';
    const topicPath = '/topics/research/';
    const latestBriefPath = '/brief/2026-11-18/';
    const olderBriefPath = '/brief/2026-10-20/';
    const draftBriefPath = '/brief/2026-12-01/';

    async function readPage(path, status = 200) {
      const response = await fetch(new URL(path, origin), {
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });
      const html = await response.text();
      assert.equal(
        response.status,
        status,
        `${path} should return HTTP ${status}`,
      );
      return html;
    }

    try {
      const [home, topics, topic, article] = await Promise.all([
        readPage('/'),
        readPage('/topics/'),
        readPage(topicPath),
        readPage(articlePath),
      ]);

      await t.test(
        'the built site exposes an installable Desk app',
        async () => {
          for (const html of [home, topics, topic, article]) {
            assert.ok(
              html.includes('rel="manifest" href="/manifest.webmanifest"'),
            );
            assert.ok(
              html.includes(
                'rel="apple-touch-icon" href="/icons/desk-180.png"',
              ),
            );
          }

          const manifest = JSON.parse(await readPage('/manifest.webmanifest'));
          assert.equal(manifest.id, '/');
          assert.equal(manifest.start_url, '/');
          assert.equal(manifest.scope, '/');
          assert.equal(manifest.display, 'standalone');
          const icons = manifest.icons.filter(
            ({ purpose }) => purpose === 'any',
          );
          assert.ok(icons.some(({ sizes }) => sizes === '192x192'));
          assert.ok(icons.some(({ sizes }) => sizes === '512x512'));
          for (const { src, sizes } of [
            ...manifest.icons,
            { src: '/icons/desk-180.png', sizes: '180x180' },
          ]) {
            const icon = await readFile(new URL(`dist${src}`, root));
            assert.equal(icon.toString('ascii', 1, 4), 'PNG');
            assert.equal(
              `${icon.readUInt32BE(16)}x${icon.readUInt32BE(20)}`,
              sizes,
            );
          }

          await readPage('/desk-sw.js');
          assert.match(await readPage('/offline.html'), /<h1>Offline<\/h1>/);
        },
      );

      await t.test(
        'the homepage links to a directly accessible article',
        () => {
          assert.ok(home.includes(`href="${articlePath}"`));
          assert.match(
            article,
            /<h1 id="article-title">阅读 Open Source<\/h1>/,
          );
          assert.match(article, /这篇笔记用于验证独立阅读页。/);
        },
      );

      await t.test(
        'the topic index, topic page, and article link to each other',
        () => {
          assert.ok(topics.includes(`href="${topicPath}"`));
          assert.ok(topic.includes(`href="${articlePath}"`));
          assert.ok(article.includes(`href="${topicPath}"`));
        },
      );

      await t.test(
        'draft articles and draft-only topics are excluded',
        async () => {
          for (const html of [home, topics, topic, article]) {
            assert.doesNotMatch(
              html,
              /Draft Note|Draft Only|\/posts\/draft-note\/|\/topics\/draft-only\//,
            );
          }
          await Promise.all([
            readPage('/posts/draft-note/', 404),
            readPage('/topics/draft-only/', 404),
          ]);
        },
      );

      await t.test(
        'the Blog toolbar opens AI Brief and its latest issue has a reading page',
        async () => {
          const [brief, issue] = await Promise.all([
            readPage('/brief/'),
            readPage(latestBriefPath),
          ]);

          const toolbar = home.match(
            /<nav\b[^>]*aria-label="Blog navigation"[^>]*>[\s\S]*?<\/nav>/,
          )?.[0];
          assert.ok(toolbar?.includes('href="/brief/"'));
          assert.equal(home.match(/<a\b[^>]*href="\/brief\/"/g)?.length, 1);
          assert.doesNotMatch(home, /Latest Issue|href="\/brief\/2026-/);

          assert.ok(brief.includes(`href="${latestBriefPath}"`));
          assert.ok(!brief.includes(`href="${olderBriefPath}"`));
          assert.ok(!brief.includes(`href="${draftBriefPath}"`));
          assert.match(brief, /November fixture highlight/);
          assert.match(
            issue,
            /<h1 id="article-title">November fixture brief<\/h1>/,
          );
          assert.match(
            issue,
            /This issue verifies the standalone brief reading page\./,
          );
          assert.match(issue, /data-language="mermaid"/);
          for (const html of [topics, topic, article]) {
            assert.doesNotMatch(html, /href="\/brief\/2026-/);
          }
        },
      );

      await t.test(
        'the brief archive groups published issues by coverage month',
        async () => {
          const olderMonthPath = '/brief/archive/2026-10/';
          const [archive, olderMonth] = await Promise.all([
            readPage('/brief/archive/'),
            readPage(olderMonthPath),
          ]);
          assert.ok(archive.includes(`href="${latestBriefPath}"`));
          assert.ok(archive.includes(`href="${olderMonthPath}"`));
          assert.ok(!archive.includes(`href="${olderBriefPath}"`));
          assert.ok(olderMonth.includes(`href="${olderBriefPath}"`));
          assert.ok(!olderMonth.includes(`href="${latestBriefPath}"`));
          for (const html of [archive, olderMonth]) {
            assert.doesNotMatch(
              html,
              /December draft brief|\/brief\/(archive\/)?2026-12/,
            );
          }
          await Promise.all([
            readPage(draftBriefPath, 404),
            readPage('/brief/archive/2026-12/', 404),
          ]);
        },
      );
    } finally {
      await server.stop();
    }
  },
);
