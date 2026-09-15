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

LinguaDock 不运行项目自有服务器。用户提交的文本会直接发送到 Google Translate 域名。任何改变这一数据边界的 Pull Request 都必须在代码、文档和界面中明确披露。
