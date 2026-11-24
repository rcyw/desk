import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  'public content and invalid frontmatter in a production build',
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
    const build = () =>
      run(process.execPath, [astroCli, 'build'], {
        cwd: directory,
        timeout: 40_000,
      });
    await build();

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
    const paperPath = '/papers/local-summary-retrieval/';

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
              html.includes('name="apple-mobile-web-app-title" content="Desk"'),
            );
            assert.ok(
              html.includes(
                'rel="apple-touch-icon" href="/icons/desk-180.png"',
              ),
            );
          }

          const manifest = JSON.parse(await readPage('/manifest.webmanifest'));
          assert.equal(manifest.id, '/');
          assert.equal(manifest.name, 'Desk');
          assert.equal(manifest.short_name, 'Desk');
          assert.equal(manifest.start_url, '/');
          assert.equal(manifest.scope, '/');
          assert.equal(manifest.display, 'standalone');
          const icons = manifest.icons.filter(
            ({ purpose }) => purpose === 'any',
          );
          assert.ok(icons.some(({ sizes }) => sizes === '192x192'));
          assert.ok(icons.some(({ sizes }) => sizes === '512x512'));
          assert.ok(
            manifest.icons.some(
              ({ purpose, sizes }) =>
                purpose === 'maskable' && sizes === '1024x1024',
            ),
          );
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
        'the homepage links to a categorized article at its original URL',
        async () => {
          assert.ok(home.includes(`href="${articlePath}"`));
          assert.match(
            article,
            /<h1 id="article-title">阅读 Open Source<\/h1>/,
          );
          assert.match(article, /这篇笔记用于验证独立阅读页。/);
          const imagePath = article.match(
            /<img\b(?=[^>]*\balt="Fixture diagram")[^>]*\bsrc="([^"]+)"/,
          )?.[1];
          assert.ok(imagePath?.startsWith('/_astro/'));
          assert.match(await readPage(imagePath), /<svg\b/);
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

      await t.test('topics without articles are excluded', async () => {
        for (const html of [home, topics, topic, article]) {
          assert.doesNotMatch(html, /Empty Topic|\/topics\/empty-topic\//);
        }
        await readPage('/topics/empty-topic/', 404);
      });

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
          await readPage('/brief/archive/2026-12/', 404);
        },
      );

      await t.test(
        'Papers opens published notes with their original source and version',
        async () => {
          const [papers, note] = await Promise.all([
            readPage('/papers/'),
            readPage(paperPath),
          ]);
          assert.match(home, /data-icon-id="papers"/);
          assert.ok(home.includes('href="/papers/"'));
          assert.ok(papers.includes(`href="${paperPath}"`));
          assert.match(papers, /用局部摘要理解分层检索/);
          assert.match(papers, /Example Preprint/);
          assert.doesNotMatch(home, /用局部摘要理解分层检索/);
          assert.doesNotMatch(topic, /用局部摘要理解分层检索/);

          assert.match(note, /<html\b[^>]*\blang="zh-CN"/);
          assert.ok(note.includes(`href="https://rcyw.github.io${paperPath}"`));
          assert.match(
            note,
            /<h1 id="article-title">用局部摘要理解分层检索<\/h1>/,
          );
          assert.ok(note.includes('href="/papers/"'));
          assert.ok(
            note.includes(
              'href="https://example.com/papers/local-summary-retrieval-v2"',
            ),
          );
          assert.match(note, /Hierarchical Retrieval with Local Summaries/);
          assert.match(note, /\bv2\b/);
          assert.match(note, /Research/);
          assert.match(note, /data-language="mermaid"/);
        },
      );

      await t.test(
        'Prompts opens an independent reading page with copyable template text',
        async () => {
          const promptPath = '/prompts/decision-fixture/';
          const [library, document] = await Promise.all([
            readPage('/prompts/'),
            readPage(promptPath),
          ]);
          assert.match(home, /data-icon-id="prompts"/);
          assert.ok(home.includes('href="/prompts/"'));
          assert.ok(library.includes(`href="${promptPath}" data-astro-reload`));
          assert.match(library, /判断练习/);
          assert.doesNotMatch(home, /判断练习/);
          assert.match(document, /<html\b[^>]*\blang="zh-CN"/);
          assert.match(document, /<h1 id="article-title">判断练习<\/h1>/);
          assert.ok(document.includes('href="/prompts/"'));
          const template = document.match(
            /<pre\b[^>]*data-language="text"[^>]*>[\s\S]*?<\/pre>/,
          )?.[0];
          assert.ok(template?.includes('我希望处理 {{问题}}。'));
          assert.doesNotMatch(template, /decision-reference|用下面的模板/);
          const english = document.match(
            /<details class="prompt-language" lang="en">[\s\S]*?<\/details>/,
          )?.[0];
          assert.ok(english?.includes('<summary>English</summary>'));
          assert.match(
            english,
            /data-language="text"[\s\S]*Give me one verifiable criterion for completion\./,
          );
          assert.ok(
            document.includes('href="https://example.com/decision-reference"'),
          );
        },
      );
    } finally {
      await server.stop();
    }

    for (const [path, value] of [
      ['posts/engineering/published-note.md', 'true'],
      ['briefs/2026/11/2026-11-18.md', 'false'],
      ['papers/local-summary-retrieval.md', 'null'],
    ]) {
      await t.test(`the build rejects draft: ${value} in ${path}`, async () => {
        const file = new URL(`content/${path}`, root);
        const markdown = await readFile(file, 'utf8');
        await writeFile(
          file,
          markdown.replace(/^---\n/, `---\ndraft: ${value}\n`),
        );
        try {
          await assert.rejects(build(), ({ stderr }) => {
            assert.match(
              stderr,
              /Remove the draft field from publishable Markdown\./,
            );
            return true;
          });
        } finally {
          await writeFile(file, markdown);
        }
      });
    }
  },
);
