---
title: Oh My Pi 如何把模型、代码工具和可恢复会话接成编码 Agent
description: 沿着一次代码修复，看终端与编辑器怎样共用 Agent 循环，模型请求怎样变成可验证的文件修改，以及会话、编辑快照和跨会话记忆分别保存什么。
lang: zh-CN
publishedAt: '2026-11-28'
topics:
  - agent-runtimes
  - state-recovery
sources:
  - label: can1357/oh-my-pi · 编码 Agent、会话与原生编辑引擎
    url: https://github.com/can1357/oh-my-pi/tree/1263bcd83293946b445e0561fc49a464366f0ead
    revision: 1263bcd83293946b445e0561fc49a464366f0ead
---

开发者希望 Agent 修好一个金额舍入错误。输入是一句需求和一棵真实的工作树，交付物是修改后的文件、能说明结果的测试，以及稍后还可继续的会话。中间有不少模型本身做不了的事：取得当前文件，判断自己读到的行是否已经变化，运行工具，再把结果交还给下一轮推理。

Oh My Pi（`omp`）是基于 Pi 扩展的编码 Agent。它既是人可以直接使用的终端程序，也提供单次输出、RPC、编辑器 ACP 和嵌入式 SDK。上游明确选择了终端优先、常用编码能力内置、高级行为可配置三个方向。这解释了为何仓库同时包含模型协议适配、通用 Agent 循环、编码会话、原生工具引擎和交互界面。下面跟随这几层，看看换一个模型、换一个编辑器或恢复会话，分别会改变什么。[项目的设计理念](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/README.md#philosophy) · [启动流程与子系统地图](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/coding-agent/DEVELOPMENT.md)

## 一套会话服务多种入口

总图把一次使用中要经过的三道边界画在一起。入口传递用户意图，模型决定下一步要请求什么，宿主实际执行被允许的工具。每次执行都能产生两种不同的输出：界面可以立刻显示进度，后续模型调用则消费已经形成的消息和工具结果。

```mermaid
flowchart TB
    accTitle: Oh My Pi 的入口、会话与模型工具循环
    accDescr: 终端、单次命令、RPC、ACP 和 SDK 驱动同一编码会话。会话向 Agent 循环提供上下文和工具，模型适配器归一化输出，工具在宿主执行后回送结果；会话持久化历史并向入口发布事件。
    front["终端 / 单次命令 / RPC / ACP / SDK"]
    guest["可选 Collab 访客"]
    front -. 经主持端分享会话事件 .-> guest
    guest -. 可控制的房间可发提示或中断 .-> front
    subgraph host["编码 Agent 宿主"]
        session["AgentSession 编码会话"]
        history[("会话树与压缩记录")]
        config["配置、项目规则与扩展"]
        loopcore["通用 Agent 循环"]
        ai["pi-ai 模型适配"]
        tools["已启用的编码工具"]
        config -->|提供提示与能力| session
        session -->|追加已完成的条目| history
        history -->|恢复分支上下文| session
        session -->|用户输入、上下文与工具| loopcore
        loopcore -->|增量消息与执行事件| session
        loopcore -->|发起模型调用| ai
        ai -->|统一文本与工具调用事件| loopcore
        loopcore -->|调度工具| tools
        tools -->|结果或错误进入下一轮| loopcore
    end
    front -->|提示或中断| session
    session -->|进度、结果与诊断| front
    ai -->|提交模型请求| model["远端或本地模型服务"]
    model -->|提供方原始流| ai
    tools -->|读写、运行与验证| tree["工作树与开发工具"]
```

`createAgentSession` 负责把配置、模型与工作目录装配起来。终端界面订阅会话事件，把增量文本、工具进度和差异画出来；一次性命令消费结果后退出；RPC 让其他程序通过标准流收发命令和事件；ACP 向编辑器暴露会话并可使用客户端提供的文件能力；SDK 调用方直接持有会话对象。启用协作分享时，远端访客可以在终端或浏览器重现同一会话，工具仍在主持人的宿主执行。由此推断，新增入口的主要成本是协议、交互与文件归属，Agent 的多轮控制逻辑可以复用。[SDK 装配](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/coding-agent/src/sdk.ts) · [RPC 协议](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/rpc.md) · [ACP 客户端桥](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/coding-agent/src/modes/acp/acp-client-bridge.ts) · [协作会话边界](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/collab.md)

### 模型为什么能换，工具为什么仍能继续工作

模型目录提供可选模型及其标识，`pi-ai` 把选中的提供方协议转换成统一的流。不同服务拆分文本片段、工具名和工具参数的方式不同；适配器对外给出一致的开始、增量、结束或错误事件，以及最终的助手消息。`packages/agent` 消费这个接口：若模型请求工具，循环找到已注册工具并派发，将结果与原调用配对，再送进下一次模型调用。用户中途发来的纠正可以在相应的轮次边界进入。这样上游既能保留流式预览，又有确定的调用结果用于下一轮；编辑器不必了解每个提供方传来的原始字段。[模型目录](https://github.com/can1357/oh-my-pi/tree/1263bcd83293946b445e0561fc49a464366f0ead/packages/catalog) · [流协议及事件传播](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/provider-streaming-internals.md) · [循环与工具调度](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/agent/src/agent-loop.ts)

### 同一个工具接口如何容纳本地操作与扩展

编码会话将内置工具、已启用的扩展工具和 MCP 工具放入同一批可调用能力，调度时按工具策略处理审批与并发。内置读写、搜索、Shell 与语言服务处理本机工作树；需要额外能力时，扩展可以注册工具、命令与事件钩子，MCP host 可以维护外部服务连接。二者的生命周期不同：扩展模块在宿主内加载并绑定到会话，会话持有 MCP host 所管单元的租约，没有持有者后由 host 按策略回收本地服务进程或远程连接。打开项目时还可能加载项目提供的配置和扩展，因此嵌入者需要明确哪些项目代码能在自己的宿主执行。[工具审批](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/approval-mode.md) · [扩展绑定流程](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/extension-loading.md) · [MCP 连接所有权](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/mcp-runtime-lifecycle.md) · [项目输入与信任](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/README.md#project-inputs-and-trust)

```mermaid
flowchart TB
    accTitle: 编码工具的执行位置与可选协作者
    accDescr: 调度器将不同请求送到本地工具、注册扩展、MCP host 或任务执行器。原生引擎协助搜索和编辑；写入由文件或客户端桥负责。子会话回传结果，可选审阅模型则直接向主会话提供建议。
    session["主会话"] -->|提供可用工具与调用策略| dispatch["循环中的工具调度"]
    dispatch -->|读、搜、改或执行| builtin["内置编码工具"]
    builtin -->|计算匹配或补丁| native["Rust 原生引擎"]
    native -->|返回匹配或候选修改| builtin
    builtin -->|写入与诊断| writer["宿主文件 / ACP 客户端桥"]
    builtin -->|返回工具结果| dispatch
    dispatch -. 调用已注册工具 .-> ext["扩展模块"]
    ext -. 返回结果 .-> dispatch
    dispatch -. 工具请求 .-> mcp["MCP 工具桥与 host"]
    mcp -->|转发调用| service["外部 MCP 服务"]
    service -->|返回 MCP 结果| mcp
    mcp -. 返回工具结果 .-> dispatch
    dispatch -. 分派 task .-> child["子会话及其工具"]
    child -->|返回结果或异步交付| session
    session -. 发送会话更新 .-> advisor["可选审阅模型"]
    advisor -. 提交审阅意见 .-> session
```

Rust 层针对搜索、语法匹配、补丁等热点提供原生实现，通过 N-API 接到 TypeScript 工具；上游给出的理由是减少频繁启动小进程的成本，并降低对宿主已安装命令的依赖。工作需要并行时，`task` 创建有独立上下文的子会话，按配置限制并发，指定时可以用隔离工作区，或要求结果符合给定结构。另一个可选组件 Advisor 观察主会话进展，用自己的上下文提供意见。一个用于委派可交回的工作，一个用于在工作进行时追加判断；两者都不能代替结果验证。[原生层设计](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/natives-architecture.md) · [任务执行与隔离选项](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/tools/task.md) · [Advisor 的职责](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/advisor-watchdog.md)

## 从“请修改”到真的改对了哪一步

继续看舍入错误。选用 `hashline` 编辑模式时，读工具返回路径、内容标签与可引用的行，并在这次对话的 `EditStore` 保存快照和已完整展示的行。此时同事在文件顶部插入十行，模型仍按照旧读数提出修改。直接写原行号容易落到另一个函数；无条件拒绝任何外部修改，又会让无关的插入也迫使模型重做阅读。原生引擎用保留的快照和当前内容定位，在符合恢复规则且位置可确定时继续。模型、项目配置也可以选择不同于 `hashline` 的编辑协议。[编辑模式与恢复规则](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/tools/edit.md) · [对话级快照存储](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/coding-agent/src/edit/store.ts)

```mermaid
sequenceDiagram
    accTitle: 一次带快照的编辑怎样回到模型下一轮
    accDescr: 模型通过 Agent 循环提出读写，工具记录返回过的文件范围。文件发生变化后，引擎重核目标，宿主只在可定位时写入。无论成功或失败，结果均经循环带回模型。
    participant M as 模型
    participant L as Agent 循环
    participant T as 读写工具
    participant E as 原生编辑状态
    participant F as 文件或客户端桥
    M-->>L: 要求读取目标范围
    L->>T: 调用 read
    T->>F: 读取当前内容
    F-->>T: 返回文本
    T->>E: 保存快照与展示过的行
    T-->>L: 返回带标签的行
    L->>M: 携带读结果继续
    Note over F: 同事插入十行
    M-->>L: 依据原标签提出编辑
    L->>T: 调用 edit
    T->>F: 取得当前文件
    F-->>T: 返回最新内容
    T->>E: 对照快照校验并定位
    alt 位置可确定
        E-->>T: 返回候选修改
        T->>F: 经写入接口应用
        F-->>T: 写入结果与可用诊断
    else 位置含糊或无法恢复
        E-->>T: 返回定位或校验错误
    end
    T-->>L: 返回工具结果或错误
    L->>M: 继续验证或重新读取
```

运行过程中看到的差异是只读预览，执行时还会重读并校验。宿主写入可能经过编辑器桥，也可能经本地写入流程触发格式化和诊断，落盘文本可能与预览不同。多文件调用会先准备各段，再按序写入；后面的系统写入失败时，前面的文件可能已经修改。由此可得一个具体的验收顺序：先重看实际差异，确认目标函数和其他文件的最终内容，再运行能区分舍入前后行为的测试。快照能验证编辑依据，行为正确性仍要由这些测试证明。[原生编辑会话](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/crates/edit/src/session.rs) · [写回及部分失败语义](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/tools/edit.md#output-and-side-effects) · [已展示行测试](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/packages/coding-agent/test/read-edit-seen-lines.test.ts)

## 恢复会话时究竟恢复了什么

| 状态 | 谁保存、如何读取 | 对下一次工作的影响 |
| --- | --- | --- |
| 对话走到了哪里 | 文件型会话以 JSONL 记录普通追加条目和父节点，由活动叶节点选定分支 | 可以回到较早讨论分叉，再为选中的路线组装上下文 |
| 下一轮模型能看到什么 | 上下文构建器沿活动路径读取记录，使用适用的压缩条目和其后保留的消息 | 长会话可以继续，压缩后的模型输入与完整历史并不相同 |
| 模型基于哪一份文件提出编辑 | 本次对话的 EditStore 持有近期快照、已展示范围等信息 | 重开进程后应以当前文件重新建立编辑依据 |
| 跨会话有哪些项目经验 | 默认关闭的记忆子系统可按配置启用，例如从持久会话生成项目摘要 | 经验供后续启动参考，当前工作树、测试和用户要求仍需重新核对 |

切换会话叶节点可以重新讨论一种方案，但单靠它不会将文件恢复到先前的字节；要保留两份独立实现，仍需隔离工作树或显式版本管理。对自建编码工具而言，这给出了一个比“加上记忆”更具体的选择：先确定哪份记录能恢复对话、哪条路径会产生真实写入，再决定是否承担长期摘要、分支和并行工作的成本。如果两个入口都要改同一份代码，首先要在二者之间共享编辑校验和工具结果契约。[会话树与历史](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/session.md) · [压缩与上下文重建](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/compaction.md) · [可选记忆后端](https://github.com/can1357/oh-my-pi/blob/1263bcd83293946b445e0561fc49a464366f0ead/docs/memory.md)
