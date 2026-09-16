# Contributing

感谢你考虑参与 LinguaDock。

## 开发流程

1. Fork 仓库并从 `main` 新建分支。
2. 安装 Node.js 20.19+、Rust stable 1.88+、Microsoft C++ Build Tools 和 WebView2 Runtime。
3. 执行 `npm ci`。
4. 修改后运行 `npm run check`。
5. Rust 改动还应通过严格静态检查：

   ```powershell
   cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
   ```

6. 提交 Pull Request，并说明行为变化、测试结果以及任何隐私或网络影响。

## 设计约束

- 保持小窗和四语同时对照的核心体验。
- 不记录用户输入或翻译历史，除非未来功能提供明确、默认关闭的选择。
- 新增外部网络请求时必须在 README 中说明目标、数据和原因。
- 新增离线服务适配器时必须禁止公网地址和 HTTP 重定向，并添加数据边界测试。
- API 密钥只能进入系统凭据存储，不得写入前端存储、日志或测试夹具。
- 不在仓库中提交 API 密钥、令牌、签名证书或用户数据。
- UI 改动需要兼顾 480px 最小宽度、900px 最大自适应高度和中文 / 日文输入法。
