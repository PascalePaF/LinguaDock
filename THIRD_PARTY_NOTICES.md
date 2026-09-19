# Third-party notices

LinguaDock is built with open-source software. The primary runtime dependencies include:

- [Tauri](https://github.com/tauri-apps/tauri) — Apache-2.0 OR MIT
- [Tauri Plugins](https://github.com/tauri-apps/plugins-workspace) — Apache-2.0 OR MIT
- [Reqwest](https://github.com/seanmonstar/reqwest) — Apache-2.0 OR MIT
- [Serde](https://github.com/serde-rs/serde) — Apache-2.0 OR MIT
- [futures-rs](https://github.com/rust-lang/futures-rs) — Apache-2.0 OR MIT
- [ferrous-opencc](https://github.com/apoint123/ferrous-opencc) — Apache-2.0
- [keyring-rs](https://github.com/open-source-cooperative/keyring-rs) — Apache-2.0 OR MIT

The development toolchain also uses TypeScript (Apache-2.0) and Vite (MIT).

The full dependency graph and exact resolved versions are recorded in `package-lock.json` and `src-tauri/Cargo.lock`. Each dependency remains subject to its own license terms.

Google Translate is a network service and is not distributed as part of this software. LibreTranslate, Argos Translate, Ollama, LM Studio, and all user-selected model files are optional external programs or services; LinguaDock does not redistribute them. Their own licenses and model terms apply when users install or run them.

DeepSeek, Alibaba Cloud Model Studio (Qwen), OpenRouter, and OpenAI are optional network services selected and configured by the user. LinguaDock does not bundle their models or API credentials, and each service remains subject to its own terms and privacy policy.

NetEase Youdao product names are referenced only for compatibility documentation. LinguaDock is not affiliated with NetEase Youdao and does not bundle, decrypt, extract, or redistribute Youdao dictionary, pronunciation, or NMT model data. Users may import their own exported wordbook data and other dictionaries for which they have appropriate rights.
