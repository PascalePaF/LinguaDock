# LinguaDock

LinguaDock is a minimal, always-on-top Windows translation popup for four-way comparison between **Simplified Chinese, English, Japanese, and Traditional Chinese**.

Type in any one of the four languages. LinguaDock detects the source and shows all four versions at once. Press `Ctrl + Alt + G` from any application to bring the window forward, or record a custom 2–5 key combination in Settings.

[Download the latest release](https://github.com/PascalePaF/LinguaDock/releases/latest) · [中文说明](README.md) · [Related-project research](docs/related-projects.md)

![LinguaDock preview](docs/preview.png)

## Highlights

- Four results at once: Simplified Chinese, English, Japanese, and Traditional Chinese
- Automatic source detection with an optional manual override
- Common parts of speech, meanings, and short usage examples for single-word input
- Automatic translation plus immediate `Ctrl + Enter` translation
- Global `Ctrl + Alt + G` shortcut with custom 2–5 key recording and conflict detection
- Optional launch at Windows sign-in, starting quietly in the system tray
- Automatic startup checks plus manual, signed in-app updates from GitHub Releases
- Frameless draggable window that adapts its dimensions to the content
- Persistent light and dark themes
- Click anywhere on a result card to copy the translation and its meanings
- Always-on-top toggle, system tray, and single-instance behavior
- Installer and portable Windows builds
- No translation history, telemetry, ads, accounts, or project-owned server

## Download

Get the two Windows x64 packages from [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest):

- `LinguaDock_1.0.1_x64-setup.exe` — NSIS installer (recommended)
- `LinguaDock_1.0.1_windows_x64_portable.zip` — extract and run `LinguaDock.exe`

Starting with V1.0.1, future releases can be installed directly from **Settings → Software Update**. V1.0.0 did not include the updater, so upgrading to V1.0.1 is the one remaining manual installation. Moving the portable executable breaks its saved autostart path, so the installer is recommended for long-term use.

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

Official release builds also require a Tauri updater signing key. GitHub Actions reads it from encrypted repository secrets and publishes the `.sig` file and `latest.json`; the private key is never committed.

See [CHANGELOG.md](CHANGELOG.md) for release details.

## License

[MIT](LICENSE)
