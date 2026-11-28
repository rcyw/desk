---
title: 工作流如何接续
description: 从运行历史跟踪一次恢复。
lang: zh-CN
publishedAt: '2026-11-18'
topics:
  - workflow-systems
  - research
sources:
  - label: Temporal
    url: https://github.com/temporalio/temporal
    revision: 03ecd1d228d2b8d9d433da55785afc9aeeead918
---

## 服务端与 Worker

```mermaid
flowchart LR
    Worker -->|读取执行历史| History
```

## 运行历史

```mermaid
sequenceDiagram
    Worker->>History: Read recorded events
```
