# 离线翻译引擎指南

译栈 LinguaDock V1.0.2 提供四种离线引擎。它们不是同一种能力的重复入口，而是从“零配置、极小体积”到“本地大模型、较高质量”的不同取舍。

## 快速选择

| 引擎 | 是否需要另装软件 | 首次准备 | 适合内容 | 主要限制 |
| --- | --- | --- | --- | --- |
| 内置词典 + OpenCC | 否 | 无 | 常用词、短语、简繁转换 | 基础词典未覆盖任意长句 |
| LibreTranslate / Argos | 是 | 安装服务并下载语言模型 | 普通句子、段落 | 模型质量和内存占用取决于 Argos 包 |
| Ollama 本地 AI | 是 | 下载一个指令模型 | 语境、语气、词义与用法 | 首次加载较慢，模型越大越占内存 |
| LM Studio 本地 AI | 是 | 下载并加载模型，启动服务器 | 语境、语气、词义与用法 | 必须让模型保持加载并开启服务 |

离线引擎地址只接受：

- `localhost`、`127.0.0.1`、`::1`
- 私有或链路本地 IP，例如 `192.168.x.x`、`10.x.x.x`
- 以 `.local` 结尾的局域网主机

因此“仅离线”不会因为误填公网地址而把原文发送到互联网。

## 1. 内置词典 + OpenCC

无需安装或下载，打开应用即可使用。

- 常用词和短语会同时给出四语结果。
- 已收录的多义词会显示简短词义与用法。
- 任意简体中文都可以离线转换为繁体中文；任意繁体中文都可以离线转换为简体中文。
- 未收录的英文、日文或完整句子不会伪造结果，卡片会提示改用本地神经引擎。

这个引擎适合作为智能模式的快速首选，但不是一个随安装包附带的完整神经翻译模型。这样可以避免安装包增加数百 MB 到数 GB。

## 2. LibreTranslate / Argos Translate

[LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) 是完全自托管的机器翻译 API，底层使用 [Argos Translate](https://github.com/argosopentech/argos-translate)。译栈通过本机 REST API 调用它，不会捆绑或修改 LibreTranslate。

一种本地安装方式：

```powershell
python -m pip install libretranslate
libretranslate --host 127.0.0.1 --port 5000 --load-only en,ja,zh
```

首次启动会准备所需语言模型，时间和下载量取决于 LibreTranslate / Argos 当前提供的包。服务启动后，在译栈中选择：

- 离线引擎：`LibreTranslate · Argos`
- 本地服务地址：`http://127.0.0.1:5000`

译栈会把 LibreTranslate 的中文结果再通过内置 OpenCC 分成简体和台湾繁体两个版本。

## 3. Ollama 本地 AI

先从 [Ollama 官方项目](https://github.com/ollama/ollama) 安装 Ollama，再下载一个支持中、英、日文的指令模型。例如：

```powershell
ollama pull qwen2.5:3b
```

然后在译栈中选择：

- 离线引擎：`Ollama 本地 AI`
- 服务地址：`http://127.0.0.1:11434`
- 模型：与 `ollama list` 中完全一致的模型名

译栈调用 Ollama 的 `/api/chat`，关闭流式输出并要求模型返回结构化 JSON。较小模型速度快、占用低，但可能遗漏词义；较大模型通常更准确，也会占用更多内存或显存。

## 4. LM Studio 本地 AI

在 [LM Studio](https://lmstudio.ai/) 中完成以下操作：

1. 下载一个支持中、英、日文的指令模型。
2. 将模型加载到内存。
3. 在 Developer / Local Server 页面启动本地 API 服务。
4. 记下界面显示的模型 ID。

译栈默认使用：

- 服务地址：`http://127.0.0.1:1234/v1`
- 模型 ID：`local-model`（应改成 LM Studio 显示的实际 ID）

译栈会自动在基础地址后补充 `/chat/completions`。LM Studio 未启动、模型未加载或模型 ID 不匹配时，“测试当前路线”会直接显示错误。

## 智能模式

默认规则：

```text
字符数 ≤ 40  → 选择的离线引擎
字符数 > 40  → 选择的在线引擎
```

阈值可在 1–500 字之间设置。计数使用 Unicode 字符数，不按 UTF-8 字节数计算。

“离线不完整时在线接力”默认开启：内置词典没有覆盖某个短语，或本地服务失败时，智能模式可以改用所选在线引擎。关闭该开关后，短内容不会因离线失败而联网；“仅离线”模式无论此开关如何都不会联网。

## 在线 AI API

“AI API”不是离线引擎，它用于连接 OpenAI 兼容的在线接口：

- 基础地址可填写 `https://…/v1`，也可以直接填写完整的 `/chat/completions` 地址。
- 模型名由接口提供商决定。
- API 密钥通过 Rust 后端写入 Windows 凭据管理器，普通设置仅保存地址与模型名。
- 删除密钥会立即从凭据管理器删除对应项。

## 常见问题

### 显示“无法连接本地服务”

确认服务进程已启动、端口与设置一致，并先点击“测试当前路线”。Windows 防火墙不应阻止回环地址；若使用局域网主机，则需要允许对应程序在专用网络通信。

### 本地 AI 返回 JSON 格式错误

本地模型没有严格遵循结构化输出要求。可尝试更换指令遵循能力更强的模型，或增加模型规模。译栈会接受纯 JSON 与 Markdown JSON 代码块，但不会从任意自然语言中猜测译文结构。

### 为什么没有把大模型直接放进安装包

不同电脑的内存、显存、CPU 指令集和质量需求差别很大。本地模型通常从数百 MB 到数十 GB 不等；强制捆绑会显著增加安装包并限制选择。译栈只提供轻量适配层，让用户决定使用哪种本地运行时和模型。

## 上游项目与许可

- [ferrous-opencc](https://github.com/apoint123/ferrous-opencc) / OpenCC 数据：Apache-2.0，随译栈编译用于简繁转换
- [Argos Translate](https://github.com/argosopentech/argos-translate)：MIT，用户单独安装
- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)：AGPL-3.0，用户单独运行的本地服务
- [Ollama](https://github.com/ollama/ollama)：MIT，用户单独安装
- [LM Studio](https://lmstudio.ai/)：用户单独安装；请查看其当前软件和模型许可

模型文件拥有各自独立的许可。下载和使用模型前，应查看模型发布页中的许可证、可接受用途和商业使用条件。
