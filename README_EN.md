# Yizhan LinguaDock

LinguaDock (Chinese brand: **译栈**, “translation dock”) is a minimal, always-on-top Windows translation popup for four-way comparison between **Simplified Chinese, English, Japanese, and Traditional Chinese**.

Type in any one of the four languages. LinguaDock detects the source and shows all four versions at once. V1.0.4 adds explicit clipboard translation and screen-region OCR while keeping translation, imported dictionaries, favorites, local history, speech, and multiple AI providers in a small window without ads, memberships, or accounts. Press `Ctrl + Alt + G` to show or hide the window, or `Ctrl + Alt + S` to start screenshot translation.

[Download the latest release](https://github.com/PascalePaF/LinguaDock/releases/latest) · [中文说明](README.md) · [Screenshot OCR](docs/screenshot-ocr.md) · [Dictionary import](docs/dictionary-import.md) · [AI providers](docs/ai-providers.md) · [OCR project study](docs/ocr-project-study.md)

![LinguaDock V1.0.4 preview](docs/preview.png)

## V1.0.4 highlights

- A paste icon beside source-language detection reads the current clipboard and translates it immediately
- `Ctrl + Alt + S` starts region OCR; both global shortcuts can be recorded as 2–5 key combinations with conflict checks
- Choose **Automatic, PixPin, or Windows OCR**; Automatic prefers an installed PixPin and otherwise uses LinguaDock's built-in selector
- The built-in path supports multiple monitors, DPI scaling, drag selection, and Escape/right-click cancellation
- Windows OCR tries installed Simplified Chinese, English, Japanese, and Traditional Chinese recognizers according to the source hint
- Built-in capture stays on the device; the screenshot is kept in memory plus one temporary PNG that is deleted after OCR
- All V1.0.3 dictionary, favorites, history, AI-provider, offline-routing, and signed-update features remain available

## Other features

- Four simultaneous results: Simplified Chinese, English, Japanese, and Traditional Chinese
- Automatic source detection with an optional manual override
- Explicit one-click paste-and-translate and optional clipboard-on-show workflows
- Screenshot translation from the composer, tray menu, or a configurable global shortcut
- Parts of speech, concise meanings, and usage examples for supported single-word results
- Automatic translation after a short typing pause
- Custom 2–5 key global shortcut recording with conflict detection
- Optional launch at Windows sign-in, starting quietly in the system tray
- Automatic startup checks plus manual, signed in-app updates from GitHub Releases
- Frameless draggable window that adapts its dimensions to the content
- Persistent light and dark themes
- Click anywhere on a result card to copy its translation and meanings
- Local dictionary center, favorites, and optional on-device history
- Always-on-top toggle, system tray, and single-instance behavior
- Installer and portable Windows builds
- No telemetry, ads, memberships, accounts, or project-owned relay server

## Download

Get the Windows x64 packages from [Releases](https://github.com/PascalePaF/LinguaDock/releases/latest):

- `LinguaDock_1.0.4_x64-setup.exe` — NSIS installer (recommended)
- `LinguaDock_1.0.4_windows_x64_portable.zip` — extract and run `LinguaDock.exe`
- `SHA256SUMS.txt` — published checksums

V1.0.1 and later can install V1.0.4 directly from **Settings → Update**. Moving the portable executable invalidates its saved autostart path, so the installer is recommended for regular use.

The public build is not commercially Authenticode-signed, so Windows SmartScreen may identify it as an unknown publisher. Download only from this repository and verify the SHA-256 checksums. In-app update packages are independently verified with Tauri’s updater signature.

## Default controls

| Action | Control |
| --- | --- |
| Show or hide from any app | `Ctrl + Alt + G` |
| Translate now | `Enter` |
| Insert a newline | `Ctrl + Enter` or `Shift + Enter` |
| Swap Enter behavior | Settings → General → Translation key |
| Paste and translate | Click the clipboard icon beside source-language detection |
| Start screenshot translation | `Ctrl + Alt + S`, the capture icon, or the tray menu |
| Cancel built-in capture | `Escape`, right-click, or trigger the screenshot shortcut again |
| Choose the OCR engine | Settings → General → Screenshot OCR |
| Hide to tray | `Esc` or the title-bar close button |
| Copy a result | Click anywhere on its result card |

## Privacy and routing

Offline-only mode never calls an online provider. Local service URLs are restricted to loopback addresses, private-network IPs, and `.local` hosts. Smart mode routes by character count and only uses online fallback when the visible fallback option is enabled.

Google mode sends submitted text and language codes to `translate.googleapis.com`. It uses a keyless endpoint used by the web client, not the supported, SLA-backed Google Cloud Translation API. AI API mode sends the text to the selected provider or user-configured endpoint. Each provider secret is stored separately in Windows Credential Manager. Imported dictionaries use local IndexedDB; local history can be disabled and cleared at any time.

Built-in Windows screenshot OCR does not upload the image. Captures live in memory and one short-lived temporary PNG, deleted as soon as OCR finishes. When PixPin is selected, LinguaDock invokes PixPin's documented script and reads only the recognized clipboard text; PixPin remains a separate user-installed application governed by its own settings and terms. After OCR, whether recognized text is sent online depends on the translation route selected by the user.

See the [screenshot OCR guide](docs/screenshot-ocr.md) and [offline engine guide](docs/offline-engines.md) for setup requirements, privacy details, and troubleshooting.

## Build from source

Requirements: Node.js 20.19+, Rust stable 1.88+, Microsoft C++ Build Tools, and WebView2 Runtime.

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
