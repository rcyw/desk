---
title: 用局部摘要理解分层检索
description: 从一份很长的技术文档出发，理解摘要如何缩小候选范围，以及原文如何支撑最终回答。
lang: zh-CN
publishedAt: '2026-11-21'
topics:
  - empty-topic
paper:
  title: Hierarchical Retrieval with Local Summaries
  source: Example Preprint
  url: https://example.com/papers/local-summary-retrieval-v2
  version: v2
---

这篇笔记用虚构论文演示 Papers 的阅读结构。

## 论文研究的问题

假设文档有几十个章节，而读者的问题只涉及某个表格。逐段检索成本较高，直接只看整篇摘要又可能漏掉关键细节。

## 关键概念

局部摘要概括一个有边界的章节。原文片段则保留精确条件、数值和上下文。

## 核心方法

先查询章节摘要，找到最可能相关的章节。再从候选章节查找原文片段，把支持答案的证据交给读者。

```mermaid
flowchart LR
  Query[读者提问] --> Summaries[匹配章节摘要]
  Summaries --> Passages[检索对应原文]
  Passages --> Evidence[核对答案证据]
```

## 证据与局限

这个例子说明了检索的顺序。要验证方法是否有效，可以用含有细节、跨章节和无答案的问题检查原文召回率。尤其要看候选章节选错时，有没有办法扩大检索范围。
