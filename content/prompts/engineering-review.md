---
title: 工程审查与交付
description: 走查项目与页面，审查 Git 历史、状态机、PR 和 CI，处理缺陷、完成交付与复盘。
lang: zh-CN
publishedAt: '2026-11-24'
sources:
  - label: Khazix · X 原帖
    url: https://x.com/Khazix0918/status/2122268349707219333
  - label: Voxyz · X 原帖
    url: https://x.com/Voxyz_ai/status/2122011755240984607
  - label: Voxyz · 项目与页面走查
    url: https://x.com/Voxyz_ai/status/2124548469540974596
---

按场景复制对应的提示词。包含 `XX` 的条目可填入你要分析的时间范围。

## 回顾 Git 历史与架构演变

```text
深入分析整个代码库的 Git 历史、关键 PR 和架构演变过程。找出哪些设计是有意为之，哪些是历史遗留，哪些是为了解决已经不存在的问题而引入的。识别可以安全移除的历史包袱。
```

来源 [Khazix · X 原帖](https://x.com/Khazix0918/status/2122268349707219333)

## 评估接手项目的认知成本

```text
假设明天有一个完全不了解项目、但是能力很强的工程师来接手。请评估他理解整个项目需要付出的认知成本，找出那些命名混乱、抽象过度、职责不清晰、需要大量上下文才能理解的代码，并提出简化方案。
```

来源 [Khazix · X 原帖](https://x.com/Khazix0918/status/2122268349707219333)

## 走查项目与页面

```text
通读整个项目，找出所有有故障、不一致、低效或已经用不到的地方。优先删除，其次简化，再考虑优化，最后考虑自动化。运行我的应用，亲自在 Chrome 中打开每个页面并截图。先列出视觉层级和信息密度方面最严重的 5 个问题。修复你有把握的问题，把其余问题列出来给我审阅。
```

<details class="prompt-language" lang="en">
<summary>English</summary>

```text
Read this entire project and find everything that's broken, inconsistent, inefficient, or no longer needed. Prefer deleting over simplifying, simplifying over optimizing, and optimizing over automating. Run my app, open every page in Chrome yourself and screenshot it. List the 5 biggest hierarchy and density problems first. Fix what you're sure about and list the rest for me to review.
```

</details>

来源 [Voxyz · X 原帖](https://x.com/Voxyz_ai/status/2124548469540974596)

## 找出近期 PR 的瓶颈

```text
全面分析最近XX天里的所有的PR，找出最慢的那几个，看看有没有导致卡顿、可以优化的地方。
```

来源 [Khazix · X 原帖](https://x.com/Khazix0918/status/2122268349707219333)

## 复盘缺陷、返工和回滚

```text
全面复盘最近XX时间的 Bug、返工、回滚和重复修改。不要只统计发生了什么，要分析这些问题背后有没有共同的根因。把能够预防的共性问题沉淀成项目规则、自动化或者Skill，避免我们反复支付同样的成本。
```

来源 [Khazix · X 原帖](https://x.com/Khazix0918/status/2122268349707219333)

## 状态机猎人

```text
找到我应用中所有的隐式状态机。做出最佳决策，始终提升这三者：用户体验 (UX)、开发者体验 (DX) 和代理体验 (AX)，同时不破坏任何东西。
```

<details class="prompt-language" lang="en">
<summary>English</summary>

```text
Find all of the implicit state machines in my app. Make the best decision that will elevate all three: the user experience (UX), developer experience (DX), and agent experience (AX) always, without breaking anything.
```

</details>

来源 [Voxyz · X 原帖](https://x.com/Voxyz_ai/status/2122011755240984607)

## 错误分类员

```text
对每个错误进行评分，从 1 到 10 分，分别评估其发生频率和严重程度。如果两个分数的乘积低于 5，就只需将其作为问题提交，而不要修改代码。不要为无人询问的罕见情况或未来情况进行设计。
```

根据你的项目调整 5 这个阈值。

<details class="prompt-language" lang="en">
<summary>English</summary>

```text
Rate each bug from 1 to 10 on how often it would happen and how bad it would be. If the two scores multiplied are below 5, just file it as an issue and leave the code alone. Do not design for rare or future cases nobody asked about.
```

Tune the threshold of 5.

</details>

来源 [Voxyz · X 原帖](https://x.com/Voxyz_ai/status/2122011755240984607)

## 收尾者

```text
在你停下来之前完成全部工作。不要提出要继续：直接继续。在你删除任何内容之前先问我。以一个适合从未见过这项工作的人的总结结束：先列出要点，用通俗的语言。
```

<details class="prompt-language" lang="en">
<summary>English</summary>

```text
Finish the whole job before you stop. Don't offer to continue: continue. Ask me before you delete anything. End with a recap for someone who saw none of the work: key points first, plain words.
```

</details>

来源 [Voxyz · X 原帖](https://x.com/Voxyz_ai/status/2122011755240984607)

## CI 审计员

```text
审计这个仓库的 CI：使用 gh 拉取最近 150 次 CI 运行，将每个作业的时间拆分为三个部分：等待队列中的机器、设置（检出、安装依赖项、恢复缓存），以及实际运行任务。列出 5 个最慢的作业以及每个部分花费的秒数。先给我报告。不要做任何更改。
```

<details class="prompt-language" lang="en">
<summary>English</summary>

```text
Audit this repo's CI: Use gh to pull the last 150 CI runs and split each job's time into three parts: waiting in the queue for a machine, setup (checkout, installing dependencies, restoring the cache), and actually running the task. List the 5 slowest jobs and how many seconds each part takes. Give me the report first. Don't change anything.
```

</details>

来源 [Voxyz · X 原帖](https://x.com/Voxyz_ai/status/2122011755240984607)
