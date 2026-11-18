# Wayne’s Desk

Desk 是一个 Astro 静态站点。Platinum9 风格的桌面默认打开 Blog 应用 **Wayne’s Notes**，展示由仓内 Markdown 生成的文章和专题。

## 本地开发

使用 [.node-version](.node-version) 和 [package.json](package.json) 中的 Node.js 与 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

构建后用 `pnpm preview --host 127.0.0.1` 预览产物。

## 写作

文章和配图放在 `content/posts/<slug>/`，专题放在 `content/topics/`。 [内容工作流](docs/content-workflow.md)

Agent 从仓库根的指引开始。 [AGENTS.md](AGENTS.md)

## 验证

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm build
pnpm test
```

## 许可

项目代码、测试和自有界面素材采用 MIT。文章与配图的授权由各条目说明。字体和 Mermaid 适用各自的许可。 [MIT 许可](LICENSE) · [第三方许可](public/licenses/)
