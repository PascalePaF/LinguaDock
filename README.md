# LinguaDock

一个极简、置顶、随叫随到的 Windows 四语翻译小窗。

输入**简体中文、English、日本語或繁體中文**中的任意一种，LinguaDock 会自动识别来源语言，并同时给出四语对照。默认快捷键 `Ctrl + Alt + G` 可以在任何应用中唤出窗口，也可以在设置中改成 2–5 键组合。

[English README](README_EN.md) · [下载最新版](https://github.com/PascalePaF/LinguaDock/releases/latest) · [相关项目调研](docs/related-projects.md)

![LinguaDock 界面预览](docs/preview.png)

## 特性

- 四语同时输出：简体中文、英语、日语、繁体中文
- 自动识别来源语言，也可以手动指定，解决只含通用汉字时的简繁歧义
- 输入单词时展示 Google 返回的常见词性、多义项和简短用法
- 输入后自动翻译；在输入框按 `Ctrl + Enter` 可立即翻译
- `Ctrl + Alt + G` 全局快捷键唤出窗口；设置中可录制 2–5 键自定义组合并检测占用冲突
- 可选 Windows 开机自启，登录后静默进入托盘
- 启动时自动检查更新，也可在设置中手动检查并一键下载安装 GitHub 签名更新
- 真正无边框的小窗，拖动标题栏任意空白位置即可移动
- 根据输入长度、译文长度和词典内容自动调整窗口宽高
- 日间 / 夜间主题一键切换，并记住选择
- 默认置顶；标题栏图钉按钮可随时取消或恢复置顶
- 关闭窗口后常驻系统托盘，单击托盘图标即可再次显示
- 点击四种语言中任意一张结果卡的任何位置即可复制该结果及其义项
- 单实例运行，不会因为重复启动出现多个窗口
- 不保存翻译历史，不采集遥测数据
- Windows 安装版与免安装便携版同时发布

## 下载和使用

前往 [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest)：

- **安装版（推荐）**：下载 `LinguaDock_1.0.1_x64-setup.exe`，按向导安装。
- **免安装版**：下载 `LinguaDock_1.0.1_windows_x64_portable.zip`，解压后运行 `LinguaDock.exe`。
- `SHA256SUMS.txt` 提供发布文件校验值。

> 从 V1.0.1 起，后续版本可以在“设置 → 软件更新”中直接更新，不需要再手动下载安装包。V1.0.0 尚未内置更新模块，因此升级到 V1.0.1 仍需手动安装这一次。免安装版移动位置后会使开机自启路径失效，长期使用建议选择安装版。

系统要求：Windows 10/11 x64，且系统中有 Microsoft Edge WebView2 Runtime。Windows 11 通常已经自带；安装版会在缺失时下载 WebView2 引导程序。

> 当前公开构建没有商业代码签名证书。首次运行时，Windows SmartScreen 可能显示“未知发布者”。请只从本仓库 Releases 下载，并核对 SHA-256 校验值。

## 操作

| 操作 | 方式 |
| --- | --- |
| 在任意应用中唤出 | `Ctrl + Alt + G`；冲突时自动使用 `Ctrl + Shift + G` |
| 立即翻译 | `Ctrl + Enter` |
| 自动翻译 | 停止输入约 0.6 秒后自动执行 |
| 移动窗口 | 按住标题栏空白处拖动 |
| 隐藏到托盘 | `Esc` 或标题栏关闭按钮 |
| 恢复窗口 | 单击托盘图标或再次按全局快捷键 |
| 置顶/取消置顶 | 标题栏图钉按钮 |
| 切换日间/夜间主题 | 标题栏主题按钮 |
| 打开设置 | 标题栏齿轮按钮 |
| 修改唤出快捷键 | 设置 → 唤出快捷键；同时按下 2–5 个按键 |
| 开机自启 | 设置 → 开机自启 |
| 检查或安装更新 | 设置 → 软件更新 |
| 复制某种译文 | 点击对应结果卡内任意位置 |

## Google 翻译与隐私说明

LinguaDock 只会把你在输入框中提交的文字、来源语言和目标语言发送到 `translate.googleapis.com`；项目不包含统计、广告、账号系统或自己的服务器，也不会保存翻译历史。

当前版本使用 Google Translate 网页客户端使用的无密钥接口。它不是带服务等级保证的 Google Cloud Translation API，可能受地区、网络环境、请求频率或 Google 接口调整影响。若用于商业或高可靠场景，建议改接官方 Google Cloud Translation API，并遵守 Google 的服务条款、配额和计费规则。

## 为什么另做一个

开发前对 GitHub 上的相近项目做了调研：

- [Crow Translate](https://github.com/crow-translate/crow-translate) 功能完整、支持多引擎与全局快捷键，但项目更重，界面侧重单次目标语言。
- [Babel Window Translator](https://github.com/Dancncn/babel-window-translator) 验证了 Tauri 置顶侧边栏、托盘和快捷键的可行性，但需要用户提供兼容 OpenAI 的模型服务。
- [GTranslate Desktop](https://github.com/NativeDesktop/GTranslate) 直接把 Google Translate 网页封装为 Electron 应用，简单直接，但体积与交互更接近完整网页。
- [WinLens](https://github.com/marco-beltrame/WinLens) 聚焦屏幕 OCR 和原位覆盖翻译，适合翻译不可选中的屏幕内容，不是快速输入式四语对照工具。

LinguaDock 的范围刻意保持很小：**输入文字 → 自动识别 → 一次得到四语结果**。本项目为独立实现，没有复制这些项目的源码。更完整的对比见 [调研记录](docs/related-projects.md)。版本变化见 [CHANGELOG](CHANGELOG.md)。

## 从源码构建

### 环境

- Node.js 20.19+（推荐当前 LTS）
- Rust stable 1.77.2+
- Windows 10/11 与 Microsoft C++ Build Tools
- WebView2 Runtime

### 命令

```powershell
npm ci
npm run check
npm run tauri -- build
```

构建产物：

- 主程序：`src-tauri/target/release/linguadock.exe`
- NSIS 安装包：`src-tauri/target/release/bundle/nsis/`

正式发布构建还需要 Tauri 更新签名私钥。仓库的 GitHub Actions 从加密 Secrets 读取私钥并生成 `.sig` 与 `latest.json`；私钥不会提交到仓库。

开发模式：

```powershell
npm run tauri -- dev
```

## 项目结构

```text
LinguaDock/
├─ src/                    # 小窗交互与样式（TypeScript + CSS）
├─ src-tauri/src/          # 翻译、语言识别、快捷键、托盘（Rust）
├─ src-tauri/capabilities/ # 最小化的桌面权限
├─ docs/                   # 截图与调研记录
└─ .github/workflows/      # Windows 构建和 Release 自动化
```

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 中的方式报告。

## 开源许可

[MIT License](LICENSE)
