# Wayne’s Desk

个人网站，以全屏 Platinum9 桌面作为入口。首页默认打开 Blog 应用 **Wayne’s Notes**。Astro 在构建时从仓库内的 Markdown 生成博客首页、专题和独立文章页。

## 本地开发

使用 [.node-version](.node-version) 和 [package.json](package.json) 中的 Node.js 与 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
pnpm check
pnpm build
```

用 `pnpm preview --host 127.0.0.1` 打开构建产物。可以从首页或专题打开文档，也可以直接访问文章地址。

首页与专题每页最多显示 10 篇文章。窗口底栏的字号与明暗设置保存在当前浏览器。

## 写作

在 `content/topics/<slug>.md` 创建专题。Frontmatter 需要 `title`、`description` 和非负整数 `order`。专题默认是英文，可以通过 `lang` 标明语言。

在 `content/posts/<slug>/index.md` 添加文章，图片可与 Markdown 放在同一目录并使用相对路径引用。目录名为稳定 URL 的一部分，使用小写字母、数字与连字符。每篇文章的 `topics` 至少列出一个已建专题的文件名，省略 `.md`。下面的文章引用 `content/topics/research-notes.md`。

```yaml
---
title: 文章标题
description: 一句说明
kind: article
lang: zh-CN
publishedAt: "2026-11-18"
topics:
  - research-notes
---
```

`kind` 支持 `article` 和 `note`，`lang` 支持 `zh-CN` 和 `en`。给有实质变化的内容加 `updatedAt`。可选的 `sources` 列表记录 `label`，并可附 `url` 和 `revision`。没有 URL 的来源以文本显示。带 `draft: true` 的条目从文章页和所有索引中排除。

## 桌面与阅读页

[桌面组件](src/platinum/) 提供 Platinum9 风格的窗口、菜单、图标和字体，附带许可声明，并适配 Astro 的静态渲染与启动窗口尺寸。[Desk](src/components/Desk.tsx) 注册桌面应用和图标，[SiteLayout](src/layouts/SiteLayout.astro) 提供 Blog 窗口内的页面，[DocumentLayout](src/layouts/DocumentLayout.astro) 提供独立阅读页。导航和控件使用英文。窗口控件与英文栏目标题使用 Chicago Kare，文章标题和正文使用 Inter 和站内加载的 Noto Sans SC。 [Noto Sans SC 许可](public/licenses/NotoSansSC-OFL.txt)
