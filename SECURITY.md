# Security Policy

## Supported versions

当前只为最新 Release 提供安全更新。

## Reporting a vulnerability

请不要在公开 Issue 中披露仍可利用的安全漏洞。使用 GitHub 仓库的 **Security → Report a vulnerability** 私下报告，并包含：

- 受影响版本
- 复现步骤
- 可能影响
- 如有，建议修复方式

请勿在报告中包含真实用户的翻译内容、访问令牌或其他敏感数据。

## Data boundary

LinguaDock 不运行项目自有服务器。根据用户选择，原文会留在应用进程、发送到用户配置的本机 / 局域网服务、发送到 Google Translate，或发送到用户选择的 DeepSeek、通义千问、OpenRouter、OpenAI / 自定义兼容 API。智能模式只有在阈值规则选择在线路线，或用户开启“离线不完整时在线接力”时才会联网。

AI API 密钥按服务商分别保存在 Windows 凭据管理器；代码不得把密钥写入浏览器存储、日志、崩溃信息或版本库。可选翻译历史存放在 WebView 本地存储，导入词库存放在本机 IndexedDB；两者都不自动上传。剪贴板读取默认关闭，只在用户开启后于窗口被唤出时执行。

本机第三方词典与模型检测必须保持只读，不得加入解密、破解、授权绕过或重新分发逻辑。任何改变数据边界、密钥存储、剪贴板读取、词库解析或自动联网行为的 Pull Request 都必须在代码、文档和界面中明确披露，并添加相应测试。
