# Wayne’s Desk

[简体中文](README.zh-CN.md)

Desk is a Platinum9-style web desktop built with Astro. It opens **Wayne’s Notes** for articles and topics. The **AI Brief** app organizes daily issues by coverage date.

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

Store articles in `content/posts/<slug>/index.md`, topic definitions in `content/topics/`, and daily issues in `content/briefs/YYYY/MM/DD/index.md`. Keep images beside their Markdown file. [Content workflow in Chinese](docs/content-workflow.md)

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
