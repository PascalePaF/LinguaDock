# LinguaDock

LinguaDock is a lightweight, always-on-top Windows translation popup for four-way comparison between **Simplified Chinese, English, Japanese, and Traditional Chinese**.

Type in any one of the four languages. LinguaDock detects the source and shows all four versions at once. Press `Ctrl + Alt + G` from any application to bring the window forward.

[Download the latest release](https://github.com/PascalePaF/LinguaDock/releases/latest) · [中文说明](README.md) · [Related-project research](docs/related-projects.md)

![LinguaDock preview](docs/preview.png)

## Highlights

- Four results at once: Simplified Chinese, English, Japanese, and Traditional Chinese
- Automatic source detection with an optional manual override
- Debounced translation that respects CJK input-method composition
- Global `Ctrl + Alt + G` shortcut with a `Ctrl + Shift + G` conflict fallback
- Always-on-top toggle, system tray, and single-instance behavior
- One-click copy for every result
- Installer and portable Windows builds
- No translation history, telemetry, ads, accounts, or project-owned server

## Download

Get the two Windows x64 packages from [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest):

- `LinguaDock_0.1.0_x64-setup.exe` — NSIS installer
- `LinguaDock_0.1.0_windows_x64_portable.zip` — extract and run `LinguaDock.exe`

The public build is not commercially code-signed, so Windows SmartScreen may identify it as an unknown publisher. Download only from this repository and verify the published SHA-256 checksums.

## Privacy and translation provider

Only submitted text and language codes are sent to `translate.googleapis.com`. LinguaDock does not store translation history or send telemetry.

This release uses a keyless endpoint used by the Google Translate web client. It is not the supported, SLA-backed Google Cloud Translation API and may change or be rate-limited. For commercial or high-reliability use, integrate the official Google Cloud Translation API and follow Google's applicable terms, quotas, and billing requirements.

## Build from source

Requirements: Node.js 20.19+, Rust stable 1.77.2+, Microsoft C++ Build Tools, and WebView2 Runtime.

```powershell
npm ci
npm run check
npm run tauri -- build
```

The NSIS installer is created in `src-tauri/target/release/bundle/nsis/`.

## License

[MIT](LICENSE)
