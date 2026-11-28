import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
      'scripts/build-offline-shell.mjs',
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

    // Include a slug shared with Blog and enough projects to fill a second page.
    const projectSlugs = [
      'published-note',
      ...Array.from({ length: 9 }, (_, index) => `project-${index + 1}`),
    ];
    for (const slug of projectSlugs) {
      const topics =
        slug === 'project-1' ? '[research, research]' : '[research]';
      await writeFile(
        new URL(`content/github/${slug}.md`, root),
        `---
title: Project ${slug}
description: Project reference.
lang: en
publishedAt: '2026-11-01'
topics: ${topics}
sources:
  - label: Example
    url: https://example.com/project
    revision: v1
---
`,
      );
    }

    for (let number = 1; number <= 10; number++) {
      await writeFile(
        new URL(`content/blog/archive-${number}.md`, root),
        `---
title: Archive note ${number}
description: Blog pagination fixture.
kind: note
lang: en
publishedAt: '2026-10-01'
topics: [research]
---
`,
      );
    }

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
    const articlePath = '/desk/blog/published-note/';
    const topicPath = '/desk/blog/topics/research/';
    const latestBriefPath = '/desk/brief/2026-11-18/';
    const olderBriefPath = '/desk/brief/2026-10-20/';
    const paperPath = '/desk/papers/local-summary-retrieval/';

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
        readPage('/desk/blog/'),
        readPage('/desk/blog/topics/'),
        readPage(topicPath),
        readPage(articlePath),
      ]);
      await t.test(
        'Desk opens Blog and both Blog lists paginate under their own URL',
        async () => {
          const launch = await readPage('/desk/');
          assert.doesNotMatch(launch, /http-equiv="refresh"|Redirecting to/i);
          assert.ok(launch.includes(`href="${articlePath}"`));
          assert.ok(
            launch.includes(
              'rel="canonical" href="https://rcyw.github.io/desk/blog/"',
            ),
          );
          assert.ok(launch.includes('href="/desk/blog/page/2/" rel="next"'));
          for (const [base, first] of [
            ['/desk/blog/', home],
            [topicPath, topic],
          ]) {
            const next = base + 'page/2/';
            assert.ok(first.includes(`href="${next}" rel="next"`));
            const second = await readPage(next);
            assert.ok(second.includes(`href="${base}" rel="prev"`));
            assert.ok(
              second.includes(
                `rel="canonical" href="https://rcyw.github.io${next}"`,
              ),
            );
          }
          for (const path of [
            '/desk/posts/published-note/',
            '/desk/topics/research/',
            '/desk/page/2/',
          ])
            await readPage(path, 404);
        },
      );

      const blogToolbar =
        home.match(
          /<nav\b[^>]*aria-label="Blog navigation"[^>]*>[\s\S]*?<\/nav>/,
        )?.[0] ?? '';

      await t.test(
        'Desk starts with its Control Strip shortcuts expanded',
        () => {
          assert.match(home, /class="p9-control-strip is-expanded"/);
          const controls = [
            ...home.matchAll(
              /aria-label="(Open AI Brief|Open Papers|Switch Window|Collapse Control Strip)"/g,
            ),
          ].map((match) => match[1]);
          assert.deepEqual(controls, [
            'Open AI Brief',
            'Open Papers',
            'Switch Window',
            'Collapse Control Strip',
          ]);
        },
      );

      await t.test(
        'the built site exposes an installable Desk app',
        async () => {
          for (const html of [home, topics, topic, article]) {
            assert.ok(
              html.includes('rel="manifest" href="/desk/manifest.webmanifest"'),
            );
            assert.ok(
              html.includes('name="apple-mobile-web-app-title" content="Desk"'),
            );
            assert.ok(
              html.includes(
                'rel="apple-touch-icon" href="/desk/icons/desk-180.png"',
              ),
            );
          }

          const manifest = JSON.parse(
            await readPage('/desk/manifest.webmanifest'),
          );
          assert.equal(manifest.id, './');
          assert.equal(manifest.name, 'Desk');
          assert.equal(manifest.short_name, 'Desk');
          assert.equal(manifest.start_url, './');
          assert.equal(manifest.scope, './');
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
            { src: './icons/desk-180.png', sizes: '180x180' },
          ]) {
            const icon = await readFile(new URL(`dist/${src}`, root));
            assert.equal(icon.toString('ascii', 1, 4), 'PNG');
            assert.equal(
              `${icon.readUInt32BE(16)}x${icon.readUInt32BE(20)}`,
              sizes,
            );
          }

          await readPage('/desk/desk-sw.js');
          assert.match(
            await readPage('/desk/offline.html'),
            /<h1>Offline<\/h1>/,
          );
        },
      );

      await t.test(
        'the Blog index links to a categorized article at its canonical URL',
        async () => {
          assert.ok(home.includes(`href="${articlePath}"`));
          assert.match(home, /class="p9-window-title">Blog<\/span>/);
          assert.match(article, /<title>阅读 Open Source — Blog<\/title>/);
          assert.match(
            article,
            /<h1 id="article-title">阅读 Open Source<\/h1>/,
          );
          assert.match(article, /这篇笔记用于验证独立阅读页。/);
          const imagePath = article.match(
            /<img\b(?=[^>]*\balt="Fixture diagram")[^>]*\bsrc="([^"]+)"/,
          )?.[1];
          assert.ok(imagePath?.startsWith('/desk/_astro/'));
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
        await readPage('/desk/blog/topics/empty-topic/', 404);
      });

      await t.test(
        'GitHub has its own window, paginated project library and reading pages',
        async () => {
          const projectPath = '/desk/github/temporal-worker-restart/';
          const [library, secondPage, document, sharedSlug] = await Promise.all(
            [
              readPage('/desk/github/'),
              readPage('/desk/github/page/2/'),
              readPage(projectPath),
              readPage('/desk/github/published-note/'),
            ],
          );
          assert.match(home, /data-icon-id="github" aria-label="GitHub"/);
          assert.match(
            blogToolbar,
            /href="\/desk\/github\/"[^>]*data-desk-app="github"/,
          );
          assert.doesNotMatch(
            blogToolbar,
            /href="https:\/\/github\.com\/rcyw\/?"/,
          );
          for (const html of [home, topics, topic, article]) {
            assert.doesNotMatch(
              html,
              /工作流如何接续|\/github\/temporal-worker-restart\//,
            );
          }
          assert.match(library, /class="p9-window-title">GitHub<\/span>/);
          assert.match(library, /aria-label="GitHub navigation"/);
          assert.ok(library.includes(`href="${projectPath}"`));
          assert.match(library, /<p>从运行历史跟踪一次恢复。<\/p>/);
          assert.ok(library.includes('href="/desk/github/page/2/" rel="next"'));
          assert.ok(secondPage.includes('href="/desk/github/" rel="prev"'));
          assert.ok(secondPage.includes('href="/desk/github/published-note/"'));
          for (const html of [library, secondPage]) {
            assert.ok(!html.includes(`href="${articlePath}"`));
          }
          assert.match(
            sharedSlug,
            /<h1 id="article-title">Project published-note<\/h1>/,
          );
          assert.match(document, /<title>工作流如何接续 — GitHub<\/title>/);
          assert.ok(
            document.includes(`href="https://rcyw.github.io${projectPath}"`),
          );
          assert.ok(document.includes('href="/desk/github/"'));
          assert.doesNotMatch(document, /href="\/desk\/blog\/topics\//);
          assert.match(document, /Repository Research/);
          assert.match(document, /data-language="mermaid"/);
          await readPage('/desk/blog/project-1/', 404);
        },
      );

      await t.test(
        'GitHub topics keep their own definitions, counts, pages and article links',
        async () => {
          const base = '/desk/github/topics/';
          const research = base + 'research/';
          const workflow = base + 'workflow-systems/';
          const project = '/desk/github/temporal-worker-restart/';
          const [index, first, next, single, detail] = await Promise.all([
            readPage(base),
            readPage(research),
            readPage(research + 'page/2/'),
            readPage(workflow),
            readPage(project),
          ]);
          assert.ok(index.includes('aria-label="GitHub navigation"'));
          assert.match(
            index,
            /href="\/desk\/github\/topics\/"[^>]*aria-current="page"/,
          );
          const rows = [
            ...index.matchAll(
              /<a class="topic-preview" href="([^"]+)">([\s\S]*?)<\/a>/g,
            ),
          ];
          assert.deepEqual(
            rows.map((row) => row[1]),
            [workflow, research],
          );
          assert.match(index, /class="topic-count-heading">Projects<\/span>/);
          assert.match(
            rows[0][2],
            /\b1\s*<span class="visually-hidden">\s*project\s*<\/span>/,
          );
          assert.match(
            rows[1][2],
            /\b11\s*<span class="visually-hidden">\s*projects\s*<\/span>/,
          );
          assert.match(
            first,
            /href="\/desk\/github\/topics\/"[^>]*aria-current="location"/,
          );
          assert.ok(first.includes(`href="${research}page/2/" rel="next"`));
          assert.ok(next.includes(`href="${research}" rel="prev"`));
          assert.ok(next.includes('href="/desk/github/published-note/"'));
          assert.ok(first.includes(`href="${project}"`));
          assert.ok(single.includes(`href="${project}"`));
          assert.equal((single.match(/class="post-preview"/g) ?? []).length, 1);
          for (const path of [base, workflow, research])
            assert.ok(detail.includes(`href="${path}"`));
          for (const html of [index, first, next, single, detail]) {
            assert.doesNotMatch(
              html,
              /href="\/desk\/blog\/topics\/|href="\/desk\/blog\/published-note\/|Unused Project Topic/,
            );
          }
          for (const html of [topics, topic, article]) {
            assert.doesNotMatch(
              html,
              /Repository Research|Workflow Systems|href="\/desk\/github\/topics\//,
            );
          }
          await readPage(base + 'unused/', 404);
          await readPage(base + 'empty-topic/', 404);
          await readPage('/desk/blog/topics/workflow-systems/', 404);
        },
      );

      await t.test(
        'the Blog toolbar opens AI Brief and its latest issue has a reading page',
        async () => {
          const [brief, issue] = await Promise.all([
            readPage('/desk/brief/'),
            readPage(latestBriefPath),
          ]);

          assert.ok(blogToolbar.includes('href="/desk/brief/"'));
          assert.equal(
            home.match(/<a\b[^>]*href="\/desk\/brief\/"/g)?.length,
            1,
          );
          assert.doesNotMatch(home, /Latest Issue|href="\/desk\/brief\/2026-/);

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
            assert.doesNotMatch(html, /href="\/desk\/brief\/2026-/);
          }
        },
      );

      await t.test(
        'the brief archive groups published issues by coverage month',
        async () => {
          const olderMonthPath = '/desk/brief/archive/2026-10/';
          const [archive, olderMonth] = await Promise.all([
            readPage('/desk/brief/archive/'),
            readPage(olderMonthPath),
          ]);
          assert.ok(archive.includes(`href="${latestBriefPath}"`));
          assert.ok(archive.includes(`href="${olderMonthPath}"`));
          assert.ok(!archive.includes(`href="${olderBriefPath}"`));
          assert.ok(olderMonth.includes(`href="${olderBriefPath}"`));
          assert.ok(!olderMonth.includes(`href="${latestBriefPath}"`));
          await readPage('/desk/brief/archive/2026-12/', 404);
        },
      );

      await t.test(
        'Papers opens published notes with their original source and version',
        async () => {
          const [papers, note] = await Promise.all([
            readPage('/desk/papers/'),
            readPage(paperPath),
          ]);
          assert.match(home, /data-icon-id="papers"/);
          assert.ok(home.includes('href="/desk/papers/"'));
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
          assert.ok(note.includes('href="/desk/papers/"'));
          assert.ok(
            note.includes(
              'href="https://example.com/papers/local-summary-retrieval-v2"',
            ),
          );
          assert.match(note, /Hierarchical Retrieval with Local Summaries/);
          assert.match(note, /\bv2\b/);
          assert.match(note, /<span\b[^>]*>Empty Topic<\/span>/);
          assert.ok(!note.includes('href="/desk/blog/topics/empty-topic/"'));
          assert.match(note, /data-language="mermaid"/);
        },
      );

      await t.test(
        'Prompts opens an independent reading page with copyable template text',
        async () => {
          const promptPath = '/desk/prompts/decision-fixture/';
          const [library, document] = await Promise.all([
            readPage('/desk/prompts/'),
            readPage(promptPath),
          ]);
          assert.match(home, /data-icon-id="prompts"/);
          assert.ok(home.includes('href="/desk/prompts/"'));
          assert.ok(library.includes(`href="${promptPath}" data-astro-reload`));
          assert.match(library, /判断练习/);
          assert.doesNotMatch(home, /判断练习/);
          assert.match(document, /<html\b[^>]*\blang="zh-CN"/);
          assert.match(document, /<h1 id="article-title">判断练习<\/h1>/);
          assert.ok(document.includes('href="/desk/prompts/"'));
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

    await t.test('a misplaced GitHub topic fails the build', async () => {
      const folder = new URL('content/github/topics/nested/', root);
      await mkdir(folder);
      await cp(
        new URL('content/github/topics/research.md', root),
        new URL('research.md', folder),
      );
      try {
        await assert.rejects(build(), ({ stderr }) => {
          assert.match(stderr, /Found nested\/research\.md/);
          return true;
        });
      } finally {
        await rm(folder, { recursive: true });
      }
    });

    await t.test(
      'a GitHub project must identify the repository version it covers',
      async () => {
        const file = new URL('content/github/project-2.md', root);
        const markdown = await readFile(file, 'utf8');
        await writeFile(file, markdown.replace('    revision: v1\n', ''));
        try {
          await assert.rejects(build(), ({ stderr }) => {
            assert.match(stderr, /Include a repository URL and its revision/);
            return true;
          });
        } finally {
          await writeFile(file, markdown);
        }
      },
    );

    await t.test(
      'a project must reference at least one topic from the GitHub catalog',
      async () => {
        const file = new URL('content/github/project-2.md', root);
        const markdown = await readFile(file, 'utf8');
        try {
          for (const [references, diagnostic] of [
            ['[]', /topics/],
            ['[empty-topic]', /references an unknown topic: empty-topic/],
          ]) {
            await writeFile(file, markdown.replace('[research]', references));
            await assert.rejects(build(), ({ stderr }) => {
              assert.match(stderr, diagnostic);
              return true;
            });
          }
        } finally {
          await writeFile(file, markdown);
        }
      },
    );

    for (const [path, value] of [
      ['blog/engineering/published-note.md', 'true'],
      ['briefs/2026/11/2026-11-18.md', 'false'],
      ['papers/local-summary-retrieval.md', 'null'],
      ['github/temporal-worker-restart.md', 'true'],
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
