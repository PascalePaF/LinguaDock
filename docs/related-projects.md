# GitHub 相关项目调研

调研日期：2026-09-15。目标是确认“Windows 置顶小窗 + 全局快捷键 + Google 翻译 + 免安装/安装发行”的已有实现方式，并找到 LinguaDock 应该保持差异化的范围。

## 对比结果

| 项目 | 平台/技术 | 与本需求接近的部分 | 主要差异 | 许可 |
| --- | --- | --- | --- | --- |
| [crow-translate/crow-translate](https://github.com/crow-translate/crow-translate) | Windows/Linux，Qt | Google 等多翻译引擎、可配置全局快捷键、语音、选中文本翻译 | 完整型翻译器，功能面较大；主要是源语言到单个目标语言 | GPL-3.0 |
| [Dancncn/babel-window-translator](https://github.com/Dancncn/babel-window-translator) | Windows，Tauri 2 + Vue | 无边框置顶窗口、托盘、全局快捷键、轻量桌面壳 | 依赖用户自己的 OpenAI 兼容模型接口，侧重聊天侧边栏和 OCR | MIT |
| [NativeDesktop/GTranslate](https://github.com/NativeDesktop/GTranslate) | Electron/Nativefier | 直接使用 Google Translate 网页、Windows 可执行程序与安装脚本 | 本质是完整网页封装；没有针对四语同时对照优化 | MIT |
| [marco-beltrame/WinLens](https://github.com/marco-beltrame/WinLens) | Windows，C# / WPF | 托盘、全局快捷键、Google Lens 风格翻译 | 聚焦 OCR 和屏幕原位覆盖，不是文字输入小窗 | MIT |
| [JasonSung0724/Lingo-ai-translator](https://github.com/JasonSung0724/Lingo-ai-translator) | macOS，SwiftUI/AppKit | 全局快捷键、快速弹窗、选中文本翻译、无跟踪 | 仅 macOS，主要使用本地/AI CLI 提供商 | MIT |

## 取舍

1. **使用 Tauri 2。** Babel Window Translator 说明 Tauri 很适合轻量置顶窗口和托盘；相比网页整体封装，LinguaDock 只保留实际需要的界面和网络代码。
2. **固定四语同时呈现。** 调研项目通常让用户先选一个目标语言；LinguaDock 把“简中、英文、日文、繁中四语对照”作为核心信息结构。
3. **全局快捷键在 Rust 层注册。** 即使小窗隐藏或前端页面没有焦点，`Ctrl + Alt + G` 仍能唤出。
4. **翻译网络请求在 Rust 层发出。** 这样不需要放宽 WebView 的外网连接权限，也避开浏览器跨域问题。
5. **不加入 OCR、划词替换、历史库或多引擎。** 这些功能有价值，但会模糊“快速输入、立刻四语对照”的产品定位。
6. **不复制现有项目源码。** 仅参考公开功能说明和架构取舍；LinguaDock 的代码和视觉界面均为独立实现。

## 后续可能方向

- 支持用户自定义全局快捷键
- 可选官方 Google Cloud Translation API
- 从剪贴板自动填充，但必须明确提供隐私开关
- ARM64 Windows 构建
- 签名后的 Windows 发布包
