# Wayne’s Desk

[English](README.md)

Desk 是用 Astro 构建的 Platinum9 风格网页桌面，默认打开 **Blog** 阅读个人文章和专题。**GitHub** 有独立的项目参考库，供开发者和 Agent 设计产品、实现功能时查阅。**AI Brief** 按覆盖日期归档日报，**Papers** 收录带有原文版本链接的论文读解。**Prompts** 提供与 Agent 协作时可复用的模板。

[打开 Desk](https://rcyw.github.io/desk/)

可从浏览器菜单安装 Desk。iPhone 或 iPad 在 Safari 的分享菜单中选择「添加到主屏幕」，并开启「作为 Web App 打开」。

## 写作

写稿、维护专题或提交审阅时，从内容工作流开始。Agent 先阅读仓库指引。[内容工作流](docs/content-workflow.md) · [AGENTS.md](AGENTS.md)

| 栏目 | Markdown 文件 | 公开直链 |
| --- | --- | --- |
| Blog 文章 | `content/posts/<slug>.md` 或 `content/posts/<category>/<slug>.md` | `/desk/posts/<slug>/` |
| GitHub 项目参考 | `content/github/<slug>.md` | `/desk/github/<slug>/` |
| AI Brief 日报 | `content/briefs/YYYY/MM/YYYY-MM-DD.md` | `/desk/brief/YYYY-MM-DD/` |
| Papers 论文读解 | `content/papers/<slug>.md` | `/desk/papers/<slug>/` |
| Prompts 模板 | `content/prompts/<slug>.md` | `/desk/prompts/<slug>/` |

开发与验证命令集中在英文 README。 [本地开发](README.md#local-development) · [验证](README.md#verification)
