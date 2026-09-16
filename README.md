# 译栈 LinguaDock

一个极简、置顶、随叫随到的 Windows 四语翻译小窗。

输入**简体中文、English、日本語或繁體中文**中的任意一种，译栈会自动识别来源语言并同时给出四语对照。V1.0.2 新增真正可控的**离线翻译、智能分流和 AI 大模型接口**；默认全局快捷键 `Ctrl + Alt + G` 可显示窗口，再按一次即可隐藏，程序仍驻留后台。

[English README](README_EN.md) · [下载最新版](https://github.com/PascalePaF/LinguaDock/releases/latest) · [离线引擎指南](docs/offline-engines.md) · [相关项目调研](docs/related-projects.md)

![译栈 LinguaDock V1.0.2 界面预览](docs/preview.png)

## V1.0.2 亮点

- 三种路线：**智能、仅离线、仅在线**
- 四种离线引擎：
  - **内置词典 + OpenCC**：零配置，适合常用词、短语和完整简繁转换
  - **LibreTranslate / Argos Translate**：本机神经机器翻译
  - **Ollama**：使用已经下载到本机的语言模型
  - **LM Studio**：使用已经加载的本地模型
- 智能分流：默认 `≤ 40` 字走离线，更多内容走在线；阈值可设为 1–500 字
- 可选“离线不完整时在线接力”，界面会明确显示实际使用的引擎
- 在线引擎可选 Google 翻译或自定义 OpenAI 兼容 AI API
- AI API 密钥只保存到 **Windows 凭据管理器**，不会写入 `localStorage` 或普通配置文件
- 默认 `Enter` 立即翻译、`Ctrl + Enter` 换行；可在设置中交换
- 全局快捷键变为显示 / 隐藏开关，再按一次隐藏窗口但不退出后台
- 全新品牌“译栈 LinguaDock”和原创四语对话图标，安装器与更新通道仍保持兼容

## 完整特性

- 四语同时输出：简体中文、英语、日语、繁体中文
- 自动识别来源语言，也可以手动指定，解决只含通用汉字时的简繁歧义
- 输入单词时展示常见词性、多义项和简短用法（取决于所选引擎）
- 停止输入约 0.6 秒后自动翻译，也可按设定的回车组合立即翻译
- `Ctrl + Alt + G` 全局快捷键显示 / 隐藏窗口；可录制 2–5 键自定义组合并检测冲突
- 可选 Windows 开机自启，登录后静默进入托盘
- 启动时自动检查更新，也可手动检查并安装 GitHub 签名更新
- 真正无边框的小窗，拖动标题栏空白位置即可移动
- 根据输入长度、译文长度和词典内容自动调整窗口宽高
- 日间 / 夜间主题一键切换并记住选择
- 默认置顶；标题栏图钉按钮可随时取消或恢复置顶
- 关闭窗口后常驻系统托盘，单击托盘图标可显示 / 隐藏
- 点击四种语言中任意一张结果卡即可复制该结果及其义项
- 单实例运行，不会因重复启动出现多个窗口
- 不保存翻译历史，不采集遥测数据，不包含广告或账号系统
- Windows 安装版与免安装便携版同时发布

## 下载和使用

前往 [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest)：

- **安装版（推荐）**：下载 `LinguaDock_1.0.2_x64-setup.exe`，按向导安装。
- **免安装版**：下载 `LinguaDock_1.0.2_windows_x64_portable.zip`，解压后运行 `LinguaDock.exe`。
- `SHA256SUMS.txt` 提供发布文件校验值。

V1.0.1 或更高版本可以直接在“设置 → 更新”中升级到 V1.0.2。免安装版移动位置后会使开机自启路径失效，长期使用建议选择安装版。

系统要求：Windows 10/11 x64，且系统中有 Microsoft Edge WebView2 Runtime。Windows 11 通常已经自带；安装版会在缺失时下载 WebView2 引导程序。

> 当前公开构建没有商业 Authenticode 代码签名证书。首次运行时，Windows SmartScreen 可能显示“未知发布者”。请只从本仓库 Releases 下载，并核对 SHA-256 校验值。应用内更新包另有 Tauri 签名校验。

## 操作

| 操作 | 默认方式 |
| --- | --- |
| 在任意应用中显示 / 隐藏 | `Ctrl + Alt + G`；冲突时首次启动自动尝试 `Ctrl + Shift + G` |
| 立即翻译 | `Enter` |
| 输入换行 | `Ctrl + Enter` 或 `Shift + Enter` |
| 交换回车行为 | 设置 → 通用 → 翻译按键 |
| 自动翻译 | 停止输入约 0.6 秒后自动执行 |
| 选择智能 / 离线 / 在线 | 设置 → 翻译 → 翻译模式 |
| 调整智能阈值 | 设置 → 翻译 → 离线字数上限 |
| 选择本地或在线引擎 | 设置 → 翻译 → 离线引擎 / 在线引擎 |
| 移动窗口 | 按住标题栏空白处拖动 |
| 隐藏到托盘 | `Esc` 或标题栏关闭按钮 |
| 置顶 / 取消置顶 | 标题栏图钉按钮 |
| 切换日间 / 夜间主题 | 标题栏主题按钮 |
| 修改全局快捷键 | 设置 → 通用；同时按下 2–5 个按键 |
| 检查或安装更新 | 设置 → 更新 |
| 复制某种译文 | 点击对应结果卡内任意位置 |

## 翻译路线与隐私

| 路线 | 原文会发送到哪里 | 说明 |
| --- | --- | --- |
| 内置词典 + OpenCC | 不离开进程 | 零配置；未收录内容只保证简繁转换 |
| LibreTranslate / Argos | 仅用户配置的本机或局域网服务 | 地址被限制为回环、私有 IP 或 `.local` 主机 |
| Ollama | 仅本机或局域网 Ollama | 需要先下载适合的模型 |
| LM Studio | 仅本机或局域网 LM Studio | 需要先加载模型并启动本地服务器 |
| Google 在线 | `translate.googleapis.com` | 无密钥网页接口；不是 Google Cloud Translation API |
| AI API 在线 | 用户填写的 OpenAI 兼容地址 | API 密钥保存在 Windows 凭据管理器 |

“仅离线”模式永远不会自动调用在线引擎。“智能”模式会按阈值选择路线；只有开启“离线不完整时在线接力”后，短内容的离线结果不完整时才会发送到所选在线引擎。状态行会显示实际使用的引擎和是否发生接力。

项目不会保存翻译历史，也没有自己的中转服务器。Google 网页接口可能受地区、网络、请求频率或接口调整影响；商业或高可靠场景应选择有正式服务承诺的 API。

本地引擎的安装方式、模型选择和常见问题见 [离线翻译引擎指南](docs/offline-engines.md)。

## 为什么另做一个

开发前及 V1.0.2 设计阶段都调研了相近的开源项目，包括 Crow Translate、Babel Window Translator、Argos Translate、LibreTranslate、Bergamot、Ollama 与 LM Studio。译栈的核心仍保持很小：**输入一次 → 自动选择路线 → 同时得到四语结果**。

本项目为独立实现，没有复制调研项目的源码。完整对比、许可和选型理由见 [调研记录](docs/related-projects.md)。版本变化见 [CHANGELOG](CHANGELOG.md)。

## 从源码构建

### 环境

- Node.js 20.19+（推荐当前 LTS）
- Rust stable 1.88+
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

正式发布构建还需要 Tauri 更新签名私钥。GitHub Actions 从加密 Secrets 读取私钥并生成 `.sig` 与 `latest.json`；私钥不会提交到仓库。

开发模式：

```powershell
npm run tauri -- dev
```

## 项目结构

```text
LinguaDock/
├─ assets/brand/                 # 品牌母版
├─ src/                          # 小窗交互与样式（TypeScript + CSS）
├─ src-tauri/src/translation.rs  # 在线、离线、智能分流与 AI 适配器
├─ src-tauri/src/offline_dictionary.json
├─ src-tauri/capabilities/       # 最小化桌面权限
├─ docs/                         # 截图、引擎指南与调研记录
└─ .github/workflows/            # Windows 构建和 Release 自动化
```

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 中的方式报告。

## 开源许可

[MIT License](LICENSE)
