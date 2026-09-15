# Contributing

感谢你考虑参与 LinguaDock。

## 开发流程

1. Fork 仓库并从 `main` 新建分支。
2. 安装 Node.js、Rust stable、Microsoft C++ Build Tools 和 WebView2 Runtime。
3. 执行 `npm ci`。
4. 修改后运行 `npm run check`。
5. 如改动涉及真实翻译接口，可额外运行：

   ```powershell
   cargo test --manifest-path src-tauri/Cargo.toml translates_with_google_live -- --ignored
   ```

6. 提交 Pull Request，并说明行为变化、测试结果以及任何隐私或网络影响。

## 设计约束

- 保持小窗和四语同时对照的核心体验。
- 不记录用户输入或翻译历史，除非未来功能提供明确、默认关闭的选择。
- 新增外部网络请求时必须在 README 中说明目标、数据和原因。
- 不在仓库中提交 API 密钥、令牌、签名证书或用户数据。
- UI 改动需要兼顾 430×560 的最小窗口尺寸和中文/日文输入法。
