# 译栈 LinguaDock

一个极简、置顶、随叫随到的 Windows 四语翻译小窗。

输入**简体中文、English、日本語或繁體中文**中的任意一种，译栈会自动识别来源语言并同时给出四语对照。V1.0.3 把高频查词体验收拢到一个无会员、无广告、无信息流的小窗中：**翻译、离线词库、收藏、历史、朗读和多家 AI API** 都可直接使用。默认全局快捷键 `Ctrl + Alt + G` 可显示窗口，再按一次即可隐藏，程序仍驻留后台。

[English README](README_EN.md) · [下载最新版](https://github.com/PascalePaF/LinguaDock/releases/latest) · [词库导入](docs/dictionary-import.md) · [AI 接入](docs/ai-providers.md) · [有道体验研究](docs/youdao-experience-study.md) · [相关项目调研](docs/related-projects.md)

![译栈 LinguaDock V1.0.3 界面预览](docs/preview.png)

## V1.0.3 亮点

- 原创的“翻译 / 词库 / 收藏 / 历史”四区工作台，保留小窗速度，不加入会员、广告、课程或信息流
- 导入 CSV、TSV、JSON、XML、TXT 和未压缩 StarDict；支持有道**导出的个人单词本 XML**
- 单词翻译时自动附加已导入词库中的精确释义；词库中心支持前缀离线搜索
- 一键收藏、全部复制、系统语音朗读；本地历史可关闭，最多保留 80 条
- 可选“快捷键唤出时读取剪贴板”，复制后按热键即可得到四语结果
- AI 服务商预设：DeepSeek、通义千问、OpenRouter、OpenAI 和自定义 OpenAI 兼容接口
- AI 翻译风格可选自然、忠实直译、精简、专业；状态行显示实际模型及 token 用量
- 每个 AI 服务商使用独立密钥槽，密钥只保存到 **Windows 凭据管理器**
- 可以检测本机网易有道翻译的离线资源并说明兼容性，但不会破解、复制或重新分发专有词典和模型
- 保留 V1.0.2 的智能 / 离线 / 在线分流、四种离线引擎、自适应窗口和签名热更新

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
- 词库、收藏和历史都在本地工作，不需要登录账号
- 可选本地翻译历史；关闭后不会记录新的翻译，可随时一键清空
- 可选唤出窗口时读取剪贴板；默认关闭，避免意外读取复制内容
- 单实例运行，不会因重复启动出现多个窗口
- 不采集遥测数据，不包含广告、会员或账号系统
- Windows 安装版与免安装便携版同时发布

## 下载和使用

前往 [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest)：

- **安装版（推荐）**：下载 `LinguaDock_1.0.3_x64-setup.exe`，按向导安装。
- **免安装版**：下载 `LinguaDock_1.0.3_windows_x64_portable.zip`，解压后运行 `LinguaDock.exe`。
- `SHA256SUMS.txt` 提供发布文件校验值。

V1.0.1 或更高版本可以直接在“设置 → 更新”中升级到 V1.0.3。免安装版移动位置后会使开机自启路径失效，长期使用建议选择安装版。

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
| 切换 DeepSeek / 千问 / OpenRouter / OpenAI | 设置 → 翻译 → 在线引擎 → AI API |
| 选择 AI 翻译风格 | 设置 → 翻译 → 翻译风格 |
| 导入或搜索词典 | 顶部“词库” |
| 收藏、朗读或复制全部 | 翻译结果上方操作栏 |
| 从剪贴板快速翻译 | 设置 → 通用 → 唤出时读取剪贴板 |
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
| AI API 在线 | DeepSeek、千问、OpenRouter、OpenAI 或用户填写的兼容地址 | 每个服务商的密钥分别保存在 Windows 凭据管理器 |

“仅离线”模式永远不会自动调用在线引擎。“智能”模式会按阈值选择路线；只有开启“离线不完整时在线接力”后，短内容的离线结果不完整时才会发送到所选在线引擎。状态行会显示实际使用的引擎和是否发生接力。

项目没有自己的中转服务器。翻译历史默认仅保存在当前 Windows 用户的 WebView 本地存储中，可在设置中关闭或在“历史”页清空；导入词库保存在本机 IndexedDB。Google 网页接口可能受地区、网络、请求频率或接口调整影响；商业或高可靠场景应选择有正式服务承诺的 API。

本地引擎的安装方式、模型选择和常见问题见 [离线翻译引擎指南](docs/offline-engines.md)。

## 为什么另做一个

开发前及 V1.0.2 设计阶段调研了 Crow Translate、Babel Window Translator、Argos Translate、LibreTranslate、Bergamot、Ollama 与 LM Studio。V1.0.3 又检查了本机网易有道翻译 11.3.22.0 的功能入口、布局资源和离线文件组织。译栈借鉴的是“快捷唤出、查词、收藏、历史、朗读”这条工作流，不复制其商标、界面素材、源码、会员功能或受授权保护的词典数据。

本项目为独立实现。详细边界见 [有道体验研究](docs/youdao-experience-study.md)，开源项目对比、许可和选型理由见 [调研记录](docs/related-projects.md)。版本变化见 [CHANGELOG](CHANGELOG.md)。

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
├─ src/                          # 小窗交互、词库数据库与样式（TypeScript + CSS）
├─ src-tauri/src/translation.rs  # 在线、离线、智能分流与 AI 适配器
├─ src-tauri/src/local_resources.rs # 第三方本地资源识别（只读）
├─ src-tauri/src/offline_dictionary.json
├─ src-tauri/capabilities/       # 最小化桌面权限
├─ docs/                         # 截图、引擎指南与调研记录
└─ .github/workflows/            # Windows 构建和 Release 自动化
```

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 中的方式报告。

## 开源许可

[MIT License](LICENSE)
