# V1.0.4：截图 OCR 与开源项目调研

调研更新日期：2026-09-19。目标是为 LinguaDock 增加“全局快捷键 → 框选 → OCR → 自动翻译”能力，同时保持安装包轻量、Windows 体验稳定、图片默认不出本机，并遵守第三方项目的许可证边界。

## 调研项目

| 项目 / 能力 | 可借鉴点 | 与 LinguaDock 的差异 | 许可与采用结论 |
| --- | --- | --- | --- |
| [nimbus-translate/screen-translator](https://github.com/nimbus-translate/screen-translator) | Windows OCR 默认、可选 PaddleOCR、区域 / 全屏 / 窗口捕获、DPI 多屏坐标、失败恢复 | Python + Qt，主体验是把译文覆盖回原位置 | MIT；借鉴任务状态、DPI 与隐私思路，不复制源码 |
| [light-misty/SanpTranslate](https://github.com/light-misty/SanpTranslate)（README 品牌为 SnapTranslate） | Tauri 2、XCap、离线 Tesseract、截图后交给 AI 翻译 | 跨平台并依赖 Tesseract；结果是截图侧栏，而非固定四语卡片 | MIT；验证 XCap 与 Tauri 组合的可行性，不复制源码 |
| [marco-beltrame/WinLens](https://github.com/marco-beltrame/WinLens) | Windows 屏幕取词、原位翻译、托盘和快捷键体验 | C# / WPF，偏 Google Lens 式覆盖显示 | MIT；参考工作流，不复制品牌或覆盖层实现 |
| [jabrailkhalil/clickntranslate](https://github.com/jabrailkhalil/clickntranslate) | 多种 OCR、在线 / 离线翻译、可配置快捷键、安装与便携包 | 功能面更大，Python 桌面栈；仓库使用 GPL-3.0 | 仅概念调研；不引入或改写其代码，避免许可证污染 |
| [PixPin 脚本能力](https://pixpin.cn/docs/configuration/script) | 官方公开 `CopyOcrText` 脚本，可复用成熟框选与 OCR 体验 | 第三方闭源应用，可能未安装，行为由其设置决定 | 可选外部集成；不捆绑、不修改、不重新分发 PixPin |
| [nashaofu/xcap](https://github.com/nashaofu/xcap) | Rust 直接枚举显示器并捕获图像，支持 Windows 与多平台 | 只负责捕获，不提供选区 UI 或 OCR | Apache-2.0；作为 V1.0.4 的屏幕捕获依赖 |
| [JichouP/win-ocr-rs](https://github.com/JichouP/win-ocr-rs) | 从 Rust 调用 Windows.Media.Ocr，体积小且不捆绑模型 | 依赖 Windows 已安装的 OCR 语言能力 | MIT；作为 V1.0.4 的本地 OCR 适配层 |

## 最终方案

V1.0.4 不是把另一个截图翻译器塞进译栈，而是提供两条可切换管线：

```text
全局快捷键 / 截图按钮 / 托盘
                │
         自动、PixPin、Windows
           ┌────┴────┐
           │         │
       PixPin      XCap 抓屏
     CopyOcrText    自有框选层
           │         │
        剪贴板    Windows.Media.Ocr
           └────┬────┘
                │
             识别文字
                │
       现有四语翻译与路由系统
```

### 为什么自动模式优先 PixPin

用户已经安装 PixPin 时，可以直接得到其成熟的选区交互与 OCR 结果，不必维护第二套相同软件。LinguaDock 只调用官方文档里的固定脚本，不执行用户输入的命令，不读取 PixPin 配置和账号数据。

### 为什么仍然内置 Windows OCR

- 产品不能把核心入口建立在另一个软件“必须安装”之上。
- Windows.Media.Ocr 使用系统能力，不需要在安装包中加入几百 MB 的模型和推理运行时。
- 简中、英语、日语和繁中与 LinguaDock 的固定四语范围一致。
- 截图和识别可完全留在设备上，隐私边界容易解释和验证。

### 为什么暂不捆绑 PaddleOCR、RapidOCR 或 Tesseract

这些方案有机会提高复杂图片、艺术字和低清截图的准确率，但会带来模型下载、原生运行库、体积、CPU 架构、更新校验和额外许可证文件等成本。V1.0.4 先交付“零额外下载的 Windows OCR + 已安装 PixPin 复用”；未来若加入高精度包，应设计为用户主动下载的独立组件，提供明确体积、哈希校验、取消和完整卸载能力。

## 从调研落实到代码的要点

1. **先抓屏再创建遮罩。** 避免把半透明框选层自己拍进截图。
2. **每个显示器一个选区窗口。** 物理坐标、负坐标和 DPI 缩放在显示器局部处理，不把不同缩放率的屏幕拼成错误坐标系。
3. **任务必须可取消且不可重入。** 同一时刻只保留一个截图会话；`Esc`、右键、再次触发快捷键或异常都会清理窗口和会话。
4. **后台做 OCR。** 图像识别放进阻塞工作线程，避免冻结 Tauri 主循环。
5. **失败也恢复主窗。** 捕获失败、OCR 空结果、线程异常都会回到译栈并给出可读错误。
6. **最小化数据寿命。** 整屏只在内存保存；裁剪区的临时 PNG 用 RAII 清理，不建立截图历史。
7. **不误读旧剪贴板。** PixPin 模式以 Windows 剪贴板序列号变化为准，不只比较文本值，因此连续识别相同文字也能正常触发。
8. **OCR 与翻译分层。** OCR 只输出文字；联网与否继续由原有“仅离线 / 智能 / 仅在线”设置决定。

## 验证范围

- 前端 TypeScript 和双入口 Vite 构建通过；`index.html` 与 `capture.html` 都进入发行包。
- Rust 单元测试覆盖选区边界、极小选区拒绝、OCR 文本规范化和语言映射。
- Windows 交互测试真实调用 XCap 抓取主显示器，并用 Windows OCR 得到非空文字。
- 界面在 560 × 360 紧凑尺寸下检查了按钮位置、暗色主题、设置页和粘贴行为。

这里的“借鉴”仅指通用交互和工程问题分析。LinguaDock 的选区层、状态机、语言择优、剪贴板序列判断和四语翻译衔接均为本仓库的独立实现。

