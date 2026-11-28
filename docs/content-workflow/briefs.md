# 按日期整理时讯

## 确定期次与选材

先确定系列名和统计窗口，时区默认为 `Asia/Shanghai`。覆盖时间从起点当刻算起，到终点之前为止。迟跑和重跑沿用原定窗口。按系列和窗口查找该期的稿件与任务 PR，每期维护一篇。

标题或正文开头标明覆盖日期。优先按事件发生时间归期，只有报道时间时注明报道时间。选出窗口内有实质变化、能核实的事项。同一事件的多份报道合成一条，写清发生了什么、为什么值得关注和原始出处。短时讯按内容需要配图。

- 已有该期稿件或任务 PR 时，在原稿上增补或校正。核对后没有可补充或更正的内容时，给出原稿路径或 PR 链接，报告「本次无更新」。
- 该期既无稿件也无对应 PR 时，可核实的材料足以成稿就新建一期，材料不足则报告「本期无稿」。

## AI Brief 日报

每期覆盖一个上海日历日，从当天 00:00 到次日 00:00 前。按覆盖日期存为 `content/briefs/YYYY/MM/YYYY-MM-DD.md`。文件日期的年、月须与上级目录对应，直链为 `/brief/YYYY-MM-DD/`。补跑、增补和校正都编辑该日的文件，`publishedAt` 记录实际首发日。配图放在日报旁的 `./assets/YYYY-MM-DD/`，用相对路径引用。

`description` 写该期摘要，可用 `highlights` 列出入口页的要点。正文每条资讯用一个小节交代变化、影响和原始出处。要点有实质更新时一并修订，并填写 `updatedAt`。

## 博客周报

通过 Blog 发布的系列用包含频率的系列名加窗口起始日期作为 `slug`，稿件位置和专题沿用 [Blog 的文件与专题规则](blog.md#文件与专题)。

例如，覆盖上海时间 2026-11-09 00:00 至 2026-11-16 00:00 前的 Agent 工程周报，存为 `content/posts/agent-engineering-weekly-2026-11-09.md`。首发时可以这样填写文件头，关联已有的 [Agent 工程专题](../../content/topics/agent-engineering.md)。

```yaml
---
title: Agent 工程周报 · 11 月 9 日至 15 日
description: 汇总本周 Agent 工程领域值得跟进的变化和出处。
kind: note
lang: zh-CN
publishedAt: '2026-11-16'
topics:
  - agent-engineering
sources:
  - label: 项目版本说明
    url: https://example.com/project/releases/v1.2.0
    revision: v1.2.0
---
```

[共用写作与发布流程](../content-workflow.md)
