# Wayne’s Desk

[简体中文](README.zh-CN.md)

Desk is a Platinum9-style web desktop built with Astro. It opens **Blog** for personal articles and their topics. **GitHub** opens a separate library of repository references for developers and agents designing products or implementing features. **AI Brief** organizes daily issues by coverage date, and **Papers** collects paper reading notes with links to the original versions. **Prompts** provides reusable instructions for working with agents.

[Open Desk](https://rcyw.github.io/desk/)

Install Desk from your browser’s menu. On iPhone or iPad, use Safari’s **Add to Home Screen** and enable **Open as Web App**.

## Local development

Use the Node.js and pnpm versions pinned by this repository. [Node.js version](.node-version) · [pnpm version](package.json)

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

After `pnpm build`, run `pnpm preview --host 127.0.0.1` to test installation and offline reading.

## Writing

Use the content workflow to choose a writing guide, manage topics, and prepare entries for review. Agents start with the repository instructions. [Content workflow in Chinese](docs/content-workflow.md) · [AGENTS.md](AGENTS.md)

| Collection | Markdown file | Published URL |
| --- | --- | --- |
| Blog articles | `content/blog/<slug>.md` or `content/blog/<category>/<slug>.md` | `/desk/blog/<slug>/` |
| GitHub project references | `content/github/<slug>.md` | `/desk/github/<slug>/` |
| AI Brief daily issues | `content/briefs/YYYY/MM/YYYY-MM-DD.md` | `/desk/brief/YYYY-MM-DD/` |
| Paper notes | `content/papers/<slug>.md` | `/desk/papers/<slug>/` |
| Prompt collections | `content/prompts/<slug>.md` | `/desk/prompts/<slug>/` |

## Verification

Format changed files with `pnpm exec prettier --write <file>`, then run these checks before committing.

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm build
pnpm test
pnpm exec playwright install --with-deps chromium webkit
pnpm test:pwa
```

## License

The code, tests, and original interface assets are MIT-licensed. Article and image licensing follows the terms stated in each entry. Fonts, Mermaid, and GitHub’s Octicons retain their respective licenses. [MIT license](LICENSE) · [Third-party licenses](public/licenses/)
