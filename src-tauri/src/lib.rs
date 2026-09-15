use futures::future::join_all;
use reqwest::{Client, StatusCode};
use serde::Serialize;
use std::{sync::Mutex, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewWindow,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const GOOGLE_TRANSLATE_ENDPOINT: &str = "https://translate.googleapis.com/translate_a/single";
const SUPPORTED_LANGUAGES: [&str; 4] = ["zh-CN", "en", "ja", "zh-TW"];
const MAX_CHARACTERS: usize = 5_000;

// These are deliberately only high-confidence, commonly used variant characters.
// When a sentence contains only shared Han characters, Simplified Chinese is the
// conservative default and the UI lets the user override the source language.
const TRADITIONAL_HINTS: &str = "這個們來時為後裡麼與開關於長問題學習體國語書車東門風電腦網絡軟體臺灣萬專業實現轉換測試應該會發現還沒將處進過種點隻鐘愛讓從頭條邊單雙無聲廣場圖畫線錶鬆乾著聽讀寫買賣價錢產業務區選擇輸入輸出譯檔資訊啟動視窗頂層顯示隱藏複製貼上儲存預設訊息連線遠端雲端簡稱歷史搜尋設定當前偵測認證帳號權限發布軟件對話結果網頁資料夾說明與臺灣龍龜馬鳥魚貓門間見貝頁現對歡歡迎請謝謝";
const SIMPLIFIED_HINTS: &str = "这个们来时为后里么与开关于长问题学习体国语书车东门风电脑网络软件台湾万专业实现转换测试应该会发现还没将处进过种点只钟爱让从头条边单双无声广场图画线表松干着听读写买卖价钱产业务区选择输入输出译档资讯启动视窗顶层显示隐藏复制粘贴储存默认讯息连线远端云端简称历史搜寻设定当前侦测认证帐号权限发布软体对话结果网页资料夹说明与台湾龙龟马鸟鱼猫门间见贝页现对欢欢迎请谢谢";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranslationItem {
    language: String,
    text: Option<String>,
    error: Option<String>,
    is_original: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranslationResponse {
    detected_language: String,
    items: Vec<TranslationItem>,
}

#[derive(Default)]
struct RuntimeStatus {
    active_shortcut: Mutex<Option<String>>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("focus-input", ());
    }
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_main_window(app);
        }
    }
}

fn count_hints(text: &str, hints: &str) -> usize {
    text.chars()
        .filter(|character| hints.contains(*character))
        .count()
}

fn detect_supported_language(text: &str) -> Option<&'static str> {
    let mut kana_count = 0usize;
    let mut han_count = 0usize;
    let mut latin_count = 0usize;

    for character in text.chars() {
        match character {
            '\u{3040}'..='\u{30ff}' | '\u{31f0}'..='\u{31ff}' => kana_count += 1,
            '\u{3400}'..='\u{4dbf}' | '\u{4e00}'..='\u{9fff}' => han_count += 1,
            'A'..='Z' | 'a'..='z' | '\u{00c0}'..='\u{024f}' => latin_count += 1,
            _ => {}
        }
    }

    if kana_count > 0 {
        return Some("ja");
    }

    if han_count > 0 {
        let traditional_score = count_hints(text, TRADITIONAL_HINTS);
        let simplified_score = count_hints(text, SIMPLIFIED_HINTS);
        return Some(if traditional_score > simplified_score {
            "zh-TW"
        } else {
            "zh-CN"
        });
    }

    if latin_count > 0 {
        return Some("en");
    }

    None
}

fn parse_translation(body: &str) -> Result<String, String> {
    if body.trim_start().starts_with('<') {
        return Err("Google 翻译暂时拒绝了请求，请稍后重试".into());
    }

    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| "Google 翻译返回了无法识别的数据".to_string())?;

    let segments = value
        .get(0)
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "Google 翻译没有返回译文".to_string())?;

    let translated = segments
        .iter()
        .filter_map(|segment| segment.get(0).and_then(serde_json::Value::as_str))
        .collect::<String>();

    if translated.trim().is_empty() {
        Err("Google 翻译没有返回译文".into())
    } else {
        Ok(translated)
    }
}

async fn translate_one(
    client: &Client,
    text: &str,
    source: &str,
    target: &str,
) -> Result<String, String> {
    let parameters = [
        ("client", "dict-chrome-ex"),
        ("sl", source),
        ("tl", target),
        ("dt", "t"),
        ("q", text),
    ];

    let response = client
        .post(GOOGLE_TRANSLATE_ENDPOINT)
        .header("Accept", "application/json,text/plain,*/*")
        .form(&parameters)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "连接 Google 翻译超时，请重试".to_string()
            } else {
                "无法连接 Google 翻译，请检查网络".to_string()
            }
        })?;

    match response.status() {
        StatusCode::TOO_MANY_REQUESTS => return Err("Google 翻译请求过于频繁，请稍后重试".into()),
        StatusCode::FORBIDDEN => return Err("Google 翻译暂时拒绝了请求".into()),
        status if !status.is_success() => {
            return Err(format!("Google 翻译服务异常（HTTP {}）", status.as_u16()))
        }
        _ => {}
    }

    let body = response
        .text()
        .await
        .map_err(|_| "读取 Google 翻译结果失败".to_string())?;
    parse_translation(&body)
}

#[tauri::command(rename_all = "camelCase")]
async fn translate_all(text: String, source_hint: String) -> Result<TranslationResponse, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("请输入需要翻译的内容".into());
    }
    if text.chars().count() > MAX_CHARACTERS {
        return Err(format!("每次最多翻译 {MAX_CHARACTERS} 个字符"));
    }

    let detected_language = if source_hint == "auto" {
        detect_supported_language(&text)
            .ok_or_else(|| "暂时无法识别这种文字，请手动选择来源语言".to_string())?
            .to_string()
    } else if SUPPORTED_LANGUAGES.contains(&source_hint.as_str()) {
        source_hint
    } else {
        return Err("不支持的来源语言".into());
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinguaDock/0.1")
        .build()
        .map_err(|_| "无法初始化网络连接".to_string())?;

    let jobs = SUPPORTED_LANGUAGES.into_iter().map(|target| {
        let client = client.clone();
        let source = detected_language.clone();
        let input = text.clone();

        async move {
            if target == source {
                TranslationItem {
                    language: target.to_string(),
                    text: Some(input),
                    error: None,
                    is_original: true,
                }
            } else {
                match translate_one(&client, &input, &source, target).await {
                    Ok(translated) => TranslationItem {
                        language: target.to_string(),
                        text: Some(translated),
                        error: None,
                        is_original: false,
                    },
                    Err(error) => TranslationItem {
                        language: target.to_string(),
                        text: None,
                        error: Some(error),
                        is_original: false,
                    },
                }
            }
        }
    });

    let items = join_all(jobs).await;

    Ok(TranslationResponse {
        detected_language,
        items,
    })
}

#[tauri::command]
fn set_window_pinned(window: WebviewWindow, pinned: bool) -> Result<(), String> {
    window
        .set_always_on_top(pinned)
        .map_err(|error| format!("无法更改窗口置顶状态：{error}"))
}

#[tauri::command]
fn hide_main_window(window: WebviewWindow) -> Result<(), String> {
    window
        .hide()
        .map_err(|error| format!("无法隐藏窗口：{error}"))
}

#[tauri::command]
fn get_active_shortcut(status: State<'_, RuntimeStatus>) -> Option<String> {
    status
        .active_shortcut
        .lock()
        .map(|shortcut| shortcut.clone())
        .unwrap_or(None)
}

pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeStatus::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let active_shortcut = ["Ctrl+Alt+G", "Ctrl+Shift+G"]
                .into_iter()
                .find(|shortcut| app.global_shortcut().register(*shortcut).is_ok())
                .map(str::to_string);

            if let Ok(mut shortcut) = app.state::<RuntimeStatus>().active_shortcut.lock() {
                *shortcut = active_shortcut;
            }

            let toggle_item = MenuItem::with_id(app, "toggle", "显示 / 隐藏", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 LinguaDock", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

            let tray_builder = TrayIconBuilder::new()
                .tooltip("LinguaDock · Ctrl+Alt+G")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            let tray_builder = if let Some(icon) = app.default_window_icon() {
                tray_builder.icon(icon.clone())
            } else {
                tray_builder
            };
            tray_builder.build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_to_hide = window.clone();
                window.on_window_event(move |window_event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = window_event {
                        api.prevent_close();
                        let _ = window_to_hide.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            translate_all,
            set_window_pinned,
            hide_main_window,
            get_active_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running LinguaDock");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_supported_scripts() {
        assert_eq!(detect_supported_language("快速翻译测试"), Some("zh-CN"));
        assert_eq!(
            detect_supported_language("這是一個繁體中文測試"),
            Some("zh-TW")
        );
        assert_eq!(
            detect_supported_language("これは日本語のテストです"),
            Some("ja")
        );
        assert_eq!(
            detect_supported_language("A quick translation test"),
            Some("en")
        );
    }

    #[test]
    fn rejects_non_language_only_input() {
        assert_eq!(detect_supported_language("12345 🎉"), None);
    }

    #[test]
    fn parses_google_segments() {
        let body =
            r#"[[["Hello ","你好 ",null,null,10],["world","世界",null,null,10]],null,"zh-CN"]"#;
        assert_eq!(parse_translation(body).unwrap(), "Hello world");
    }

    #[test]
    fn rejects_html_block_page() {
        let body = "<html><title>Sorry...</title></html>";
        assert!(parse_translation(body).unwrap_err().contains("拒绝"));
    }

    #[test]
    #[ignore = "requires a live Google Translate connection"]
    fn translates_with_google_live() {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("Mozilla/5.0 LinguaDock-Test/0.1")
            .build()
            .unwrap();

        let translated =
            tauri::async_runtime::block_on(translate_one(&client, "你好，世界", "zh-CN", "en"))
                .unwrap();

        assert!(translated.to_lowercase().contains("hello"));
    }

    #[test]
    #[ignore = "requires a live Google Translate connection"]
    fn translates_all_four_languages_live() {
        let response = tauri::async_runtime::block_on(translate_all(
            "快速翻译测试".to_string(),
            "auto".to_string(),
        ))
        .unwrap();

        assert_eq!(response.detected_language, "zh-CN");
        assert_eq!(response.items.len(), 4);
        assert!(response.items.iter().all(|item| item.text.is_some()));
        assert_eq!(
            response
                .items
                .iter()
                .filter(|item| item.is_original)
                .count(),
            1
        );
    }
}
