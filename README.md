# Wayne’s Desk

[简体中文](README.zh-CN.md)

Desk is a Platinum9-style web desktop built with Astro. It opens **Blog** for articles and topics. **AI Brief** organizes daily issues by coverage date, and **Papers** collects paper reading notes with links to the original versions. **Prompts** provides reusable instructions for working with agents.

[Open Desk](https://rcyw.github.io/)

Install Desk from your browser’s menu. On iPhone or iPad, use Safari’s **Add to Home Screen** and enable **Open as Web App**.

## Local development

Use the Node.js and pnpm versions pinned by this repository. [Node.js version](.node-version) · [pnpm version](package.json)

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

After `pnpm build`, run `pnpm preview --host 127.0.0.1` to test installation and offline reading.

## Writing

Start articles at `content/posts/<slug>.md`. Use `content/posts/<category>/<slug>.md` when a single category folder helps. The filename supplies the globally unique lowercase hyphenated slug for `/posts/<slug>/`. Use frontmatter `topics` to list the topics an article belongs to. Topic definitions live in `content/topics/`.

Store daily issues at `content/briefs/YYYY/MM/YYYY-MM-DD.md`, with the coverage date matching the parent year and month. The date supplies the URL `/brief/YYYY-MM-DD/`.

Store paper notes at `content/papers/<slug>.md` for `/papers/<slug>/`. Use the shared `topics` and record the original source and version in `paper` metadata. Put images in `./assets/<slug>/` or `./assets/YYYY-MM-DD/` beside the corresponding Markdown file. [Content workflow in Chinese](docs/content-workflow.md)

Store prompt collections at `content/prompts/<slug>.md` for `/prompts/<slug>/`. [Prompt writing guide in Chinese](docs/content-workflow.md#prompts-模板)

Agents start with the repository instructions. [AGENTS.md](AGENTS.md)

## Verification

Format changed files with `pnpm exec prettier --write <file>`, then run these checks before committing.

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm build
pnpm test
```

## License

The code, tests, and original interface assets are MIT-licensed. Article and image licensing follows the terms stated in each entry. Fonts and Mermaid retain their respective licenses. [MIT license](LICENSE) · [Third-party licenses](public/licenses/)
