# Wayne’s Desk

[English](README.md)

Desk 是用 Astro 构建的 Platinum9 风格网页桌面，默认打开 **Blog** 阅读个人文章和专题。**GitHub** 有独立的项目参考库，供开发者和 Agent 设计产品、实现功能时查阅。**AI Brief** 按覆盖日期归档日报，**Papers** 收录带有原文版本链接的论文读解。**Prompts** 提供与 Agent 协作时可复用的模板。

[打开 Desk](https://rcyw.github.io/)

可从浏览器菜单安装 Desk。iPhone 或 iPad 在 Safari 的分享菜单中选择「添加到主屏幕」，并开启「作为 Web App 打开」。

## 写作

个人博客文章放在 `content/posts/<slug>.md`，需要分类时用 `content/posts/<category>/<slug>.md`，保留一层分类目录。文件名使用全局唯一的小写短横线 `slug`，决定直链 `/posts/<slug>/`。用 frontmatter 的 `topics` 关联一个或多个专题，专题定义放在 `content/topics/`。

GitHub 项目参考放在 `content/github/<slug>.md`，每个仓库维护一篇。Desk 自动收录到 `/github/`，文章直链为 `/github/<slug>/`。在同一条 `sources` 记录中填写仓库地址和所读版本。在 `topics` 填入一个或多个 `content/github/topics/` 中定义的专题，读者可以从 `/github/topics/` 按问题查找项目。用 Mermaid 展示全局架构和核心组件交互时序。[项目参考写法](docs/content-workflow.md#github-项目参考)

日报放在 `content/briefs/YYYY/MM/YYYY-MM-DD.md`，文件日期须和上级年、月目录对应，直链为 `/brief/YYYY-MM-DD/`。

论文读解放在 `content/papers/<slug>.md`，直链为 `/papers/<slug>/`。用共用的 `topics` 关联专题，并在 `paper` 中记录原论文的出处与版本。配图放在 Markdown 文件旁的 `./assets/<slug>/` 或 `./assets/YYYY-MM-DD/`。 [内容工作流](docs/content-workflow.md)

提示词放在 `content/prompts/<slug>.md`，直链为 `/prompts/<slug>/`。 [模板写作说明](docs/content-workflow.md#prompts-模板)

开发与验证命令集中在英文 README。 [本地开发](README.md#local-development) · [验证](README.md#verification)
