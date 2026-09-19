# GitHub 相关项目与离线方案调研

调研更新日期：2026-09-19。目标是确认“Windows 置顶小窗 + 全局快捷键 + 四语同屏 + 在线 / 离线 / AI 翻译 + 安装与免安装发行”的现有实现，并为可维护的本地引擎接入方式提供依据。V1.0.4 的截图工具、OCR 依赖与许可证对比另见 [截图 OCR 项目调研](ocr-project-study.md)。

## 桌面翻译项目

| 项目 | 平台 / 技术 | 与本需求接近的部分 | 主要差异 | 许可 |
| --- | --- | --- | --- | --- |
| [crow-translate/crow-translate](https://github.com/crow-translate/crow-translate) | Windows / Linux，Qt | 多引擎、全局快捷键、语音、选中文本翻译 | 完整型翻译器，功能面更大；主要是源语言到选定目标语言 | GPL-3.0 |
| [Dancncn/babel-window-translator](https://github.com/Dancncn/babel-window-translator) | Windows，Tauri 2 + Vue | 无边框置顶窗口、托盘、全局快捷键、OpenAI 兼容接口 | 侧重聊天侧边栏和 OCR，需要用户自己的模型服务 | MIT |
| [NativeDesktop/GTranslate](https://github.com/NativeDesktop/GTranslate) | Electron / Nativefier | 使用 Google Translate 网页、Windows 可执行程序与安装脚本 | 本质是完整网页封装，没有四语同时对照布局 | MIT |
| [marco-beltrame/WinLens](https://github.com/marco-beltrame/WinLens) | Windows，C# / WPF | 托盘、全局快捷键、Google Lens 风格翻译 | 聚焦 OCR 和屏幕原位覆盖，不是文字输入小窗 | MIT |
| [JasonSung0724/Lingo-ai-translator](https://github.com/JasonSung0724/Lingo-ai-translator) | macOS，SwiftUI / AppKit | 全局快捷键、快速弹窗、本地 / AI CLI 提供商 | 仅 macOS，交互重点是选中文本 | MIT |

## 离线翻译与本地模型项目

| 项目 | 定位 | 集成评估 | V1.0.2 决策 | 许可 |
| --- | --- | --- | --- | --- |
| [argosopentech/argos-translate](https://github.com/argosopentech/argos-translate) | Python 离线神经机器翻译，模型使用 `.argosmodel` 包 | 支持中、英、日语言包和中间语言转译，但直接嵌入 Rust / Tauri 需要捆绑 Python、原生推理依赖和大型模型 | 通过 LibreTranslate 本地 API 间接接入 | MIT |
| [LibreTranslate/LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) | 完全自托管的机器翻译 REST API，底层为 Argos Translate | API 边界稳定，适合与桌面壳解耦；用户可自行控制语言模型和硬件 | 作为本地神经翻译选项 | AGPL-3.0 |
| [browsermt/bergamot-translator](https://github.com/browsermt/bergamot-translator) | Marian 系列客户端机器翻译，支持 C++ / WASM | 真正端侧、性能良好，但模型转换、WASM/C++ 构建和分发复杂度较高 | 继续观察，不在 V1.0.2 中捆绑 | MPL-2.0 |
| [ollama/ollama](https://github.com/ollama/ollama) | 本地大模型运行时与 REST API | `/api/chat` 支持关闭流式输出和 JSON 结构化结果；模型选择灵活 | 作为本地 AI 选项 | MIT |
| [lmstudio-ai/lms](https://github.com/lmstudio-ai/lms) | LM Studio 的开源 CLI；桌面应用提供本地 OpenAI 兼容服务 | 对已经使用 LM Studio 的用户友好；无需在译栈中管理模型文件 | 作为本地 AI 选项 | MIT（CLI）；桌面应用另见官方条款 |
| [apoint123/ferrous-opencc](https://github.com/apoint123/ferrous-opencc) | 纯 Rust OpenCC 实现，内置简繁词典 | 无外部运行时、可直接静态编译、适合安装包内置 | 用于完整简繁转换 | Apache-2.0 |

## V1.0.2 的取舍

1. **保留 Tauri 2。** 翻译请求、凭据访问和全局快捷键都在 Rust 层完成，WebView 不需要外网连接权限。
2. **固定四语同时呈现。** 用户不必反复切换目标语言；同一输入始终得到简中、英文、日文和繁中四张卡片。
3. **不把大型神经模型塞进安装包。** 本地模型从数百 MB 到数十 GB，且硬件需求差异很大。应用提供适配器，用户选择运行时和模型。
4. **提供一个零配置离线底座。** 内置基础词典处理高频短词，ferrous-opencc 处理任意简繁转换；无法翻译的内容明确报错，不伪造结果。
5. **本地神经引擎进程外运行。** LibreTranslate、Ollama 和 LM Studio 由用户单独安装、更新和选择模型，译栈只访问回环或私有网络地址。
6. **智能联网必须可见、可关。** 阈值规则和在线接力开关都在设置中直接呈现，状态行显示最终使用的引擎。
7. **AI 密钥不进入前端存储。** 使用 Windows 凭据管理器，前端只能查询“已保存 / 未保存”，不能读取密钥明文。
8. **保留更新身份。** 视觉品牌升级为“译栈 LinguaDock”，但安装器产品名、包标识、可执行文件和 GitHub 仓库不变，确保 V1.0.1 能热更新。

## 未直接采用的方案

- **直接嵌入 Argos Python：** 会显著增加安装包、启动复杂度和原生依赖维护成本。
- **直接嵌入 Bergamot C++ / WASM：** 技术上可行，但 V1.0.2 需要额外解决模型格式、线程、SIMD、许可证文件与按需下载体验。
- **只接一个本地大模型：** 不能覆盖低配置电脑，也无法满足希望使用传统神经机器翻译的用户。
- **离线失败后无条件联网：** 容易造成隐私误解，因此仅在智能模式且显式开关开启时允许。

本项目为独立实现，没有复制上述项目源码。外部服务和运行时由用户单独安装；译栈仓库只包含自身适配代码、内置基础词典以及依法分发的 Rust 依赖。
