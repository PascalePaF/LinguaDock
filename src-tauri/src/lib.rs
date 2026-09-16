use futures::future::join_all;
use reqwest::{Client, StatusCode};
use serde::Serialize;
use std::{sync::Mutex, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, State, WebviewWindow,
};
use tauri_plugin_autostart::MacosLauncher;
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
struct DictionarySense {
    part_of_speech: String,
    meanings: Vec<String>,
}

#[derive(Debug, Clone)]
struct GoogleTranslation {
    text: String,
    senses: Vec<DictionarySense>,
    examples: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranslationItem {
    language: String,
    text: Option<String>,
    error: Option<String>,
    is_original: bool,
    senses: Vec<DictionarySense>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranslationResponse {
    detected_language: String,
    is_single_word: bool,
    examples: Vec<String>,
    items: Vec<TranslationItem>,
}

#[derive(Default)]
struct RuntimeStatus {
    active_shortcut: Mutex<Option<String>>,
}

fn normalize_shortcut(raw: &str) -> Result<String, String> {
    let parts = raw
        .split('+')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if !(2..=5).contains(&parts.len()) {
        return Err("快捷键必须由 2 到 5 个按键组成".into());
    }

    let mut modifiers = Vec::new();
    let mut main_key: Option<String> = None;
    for part in parts {
        let canonical_modifier = match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => Some("Ctrl"),
            "alt" | "option" => Some("Alt"),
            "shift" => Some("Shift"),
            "super" | "meta" | "win" | "windows" | "command" | "cmd" => Some("Super"),
            _ => None,
        };

        if let Some(modifier) = canonical_modifier {
            if modifiers.contains(&modifier) {
                return Err("快捷键不能包含重复按键".into());
            }
            modifiers.push(modifier);
            continue;
        }

        if main_key.is_some() {
            return Err("快捷键只能包含一个普通按键".into());
        }

        let upper = part.to_ascii_uppercase();
        let valid_single = upper.len() == 1
            && upper
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_alphanumeric());
        let valid_function = upper
            .strip_prefix('F')
            .and_then(|value| value.parse::<u8>().ok())
            .is_some_and(|value| (1..=24).contains(&value));
        let named_key = match upper.as_str() {
            "SPACE" => Some("Space"),
            "TAB" => Some("Tab"),
            "ENTER" | "RETURN" => Some("Enter"),
            "ESC" | "ESCAPE" => Some("Escape"),
            "BACKSPACE" => Some("Backspace"),
            "DELETE" => Some("Delete"),
            "INSERT" => Some("Insert"),
            "HOME" => Some("Home"),
            "END" => Some("End"),
            "PAGEUP" => Some("PageUp"),
            "PAGEDOWN" => Some("PageDown"),
            "ARROWUP" => Some("ArrowUp"),
            "ARROWDOWN" => Some("ArrowDown"),
            "ARROWLEFT" => Some("ArrowLeft"),
            "ARROWRIGHT" => Some("ArrowRight"),
            _ => None,
        };

        if valid_single || valid_function {
            main_key = Some(upper);
        } else if let Some(named_key) = named_key {
            main_key = Some(named_key.to_string());
        } else {
            return Err("这个普通按键暂不支持，请使用字母、数字、F1–F24 或常用功能键".into());
        }
    }

    if modifiers.is_empty() || main_key.is_none() {
        return Err("快捷键需要至少一个修饰键和一个普通按键".into());
    }

    modifiers.push(main_key.as_deref().unwrap_or_default());
    Ok(modifiers.join("+"))
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

fn is_single_word(text: &str, language: &str) -> bool {
    let trimmed = text.trim();
    let character_count = trimmed.chars().count();
    if character_count == 0 || character_count > 32 || trimmed.chars().any(char::is_whitespace) {
        return false;
    }

    if trimmed
        .chars()
        .any(|character| "，。！？；：、,.!?;:/\\()[]{}\"“”‘’".contains(character))
    {
        return false;
    }

    match language {
        "en" => trimmed
            .chars()
            .all(|character| character.is_alphabetic() || matches!(character, '\'' | '-')),
        "zh-CN" | "zh-TW" | "ja" => character_count <= 12,
        _ => false,
    }
}

fn strip_google_markup(text: &str) -> String {
    text.replace("<b>", "")
        .replace("</b>", "")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

fn parse_google_translation(body: &str) -> Result<GoogleTranslation, String> {
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
        return Err("Google 翻译没有返回译文".into());
    }

    let senses = value
        .get(1)
        .and_then(serde_json::Value::as_array)
        .map(|groups| {
            groups
                .iter()
                .filter_map(|group| {
                    let part_of_speech = group.get(0)?.as_str()?.trim();
                    let raw_meanings = group.get(1)?.as_array()?;
                    let mut meanings = Vec::new();

                    for meaning in raw_meanings.iter().filter_map(serde_json::Value::as_str) {
                        let meaning = meaning.trim();
                        if !meaning.is_empty()
                            && !meanings.iter().any(|existing: &String| existing == meaning)
                        {
                            meanings.push(meaning.to_string());
                        }
                        if meanings.len() == 6 {
                            break;
                        }
                    }

                    if part_of_speech.is_empty() || meanings.is_empty() {
                        None
                    } else {
                        Some(DictionarySense {
                            part_of_speech: part_of_speech.to_string(),
                            meanings,
                        })
                    }
                })
                .take(5)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let examples = value
        .get(13)
        .and_then(|section| section.get(0))
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            let mut examples = Vec::new();
            for example in entries
                .iter()
                .filter_map(|entry| entry.get(0))
                .filter_map(serde_json::Value::as_str)
            {
                let example = strip_google_markup(example).trim().to_string();
                if !example.is_empty() && !examples.contains(&example) {
                    examples.push(example);
                }
                if examples.len() == 3 {
                    break;
                }
            }
            examples
        })
        .unwrap_or_default();

    Ok(GoogleTranslation {
        text: translated,
        senses,
        examples,
    })
}

#[cfg(test)]
fn parse_translation(body: &str) -> Result<String, String> {
    parse_google_translation(body).map(|translation| translation.text)
}

async fn translate_one(
    client: &Client,
    text: &str,
    source: &str,
    target: &str,
    include_dictionary: bool,
) -> Result<GoogleTranslation, String> {
    let mut parameters = vec![
        ("client", "dict-chrome-ex"),
        ("sl", source),
        ("tl", target),
        ("dt", "t"),
        ("q", text),
    ];
    if include_dictionary {
        parameters.push(("dt", "bd"));
        parameters.push(("dt", "ex"));
    }

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
    parse_google_translation(&body)
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
    let single_word = is_single_word(&text, &detected_language);

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinguaDock/1.0")
        .build()
        .map_err(|_| "无法初始化网络连接".to_string())?;

    let jobs = SUPPORTED_LANGUAGES.into_iter().map(|target| {
        let client = client.clone();
        let source = detected_language.clone();
        let input = text.clone();

        async move {
            if target == source {
                (
                    TranslationItem {
                        language: target.to_string(),
                        text: Some(input),
                        error: None,
                        is_original: true,
                        senses: Vec::new(),
                    },
                    Vec::new(),
                )
            } else {
                match translate_one(&client, &input, &source, target, single_word).await {
                    Ok(translated) => (
                        TranslationItem {
                            language: target.to_string(),
                            text: Some(translated.text),
                            error: None,
                            is_original: false,
                            senses: translated.senses,
                        },
                        translated.examples,
                    ),
                    Err(error) => (
                        TranslationItem {
                            language: target.to_string(),
                            text: None,
                            error: Some(error),
                            is_original: false,
                            senses: Vec::new(),
                        },
                        Vec::new(),
                    ),
                }
            }
        }
    });

    let completed = join_all(jobs).await;
    let mut items = Vec::with_capacity(SUPPORTED_LANGUAGES.len());
    let mut examples = Vec::new();
    for (item, item_examples) in completed {
        items.push(item);
        for example in item_examples {
            if examples.len() == 3 {
                break;
            }
            if !examples.contains(&example) {
                examples.push(example);
            }
        }
    }

    Ok(TranslationResponse {
        detected_language,
        is_single_word: single_word,
        examples,
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
fn start_window_drag(window: WebviewWindow) -> Result<(), String> {
    window
        .start_dragging()
        .map_err(|error| format!("无法移动窗口：{error}"))
}

#[tauri::command]
fn resize_main_window(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    if !width.is_finite() || !height.is_finite() {
        return Err("窗口尺寸无效".into());
    }

    window
        .set_size(LogicalSize::new(
            width.clamp(480.0, 900.0),
            height.clamp(270.0, 900.0),
        ))
        .map_err(|error| format!("无法调整窗口大小：{error}"))
}

#[tauri::command]
fn get_active_shortcut(status: State<'_, RuntimeStatus>) -> Option<String> {
    status
        .active_shortcut
        .lock()
        .map(|shortcut| shortcut.clone())
        .unwrap_or(None)
}

#[tauri::command]
fn set_global_shortcut(
    app: AppHandle,
    status: State<'_, RuntimeStatus>,
    shortcut: String,
) -> Result<String, String> {
    let normalized = normalize_shortcut(&shortcut)?;
    let previous = status
        .active_shortcut
        .lock()
        .map_err(|_| "无法读取当前快捷键".to_string())?
        .clone();

    if previous.as_deref() == Some(normalized.as_str()) {
        return Ok(normalized);
    }

    app.global_shortcut()
        .register(normalized.as_str())
        .map_err(|error| format!("快捷键不可用，可能已被其他软件占用：{error}"))?;

    if let Some(previous) = previous.as_deref() {
        if let Err(error) = app.global_shortcut().unregister(previous) {
            let _ = app.global_shortcut().unregister(normalized.as_str());
            return Err(format!("无法替换原快捷键：{error}"));
        }
    }

    if let Ok(mut active) = status.active_shortcut.lock() {
        *active = Some(normalized.clone());
    }
    if let Some(tray) = app.tray_by_id("linguadock-tray") {
        let _ = tray.set_tooltip(Some(format!("LinguaDock · {normalized}")));
    }

    Ok(normalized)
}

pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeStatus::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            let launch_hidden = std::env::args().any(|argument| argument == "--hidden");
            let active_shortcut = ["Ctrl+Alt+G", "Ctrl+Shift+G"]
                .into_iter()
                .find(|shortcut| app.global_shortcut().register(*shortcut).is_ok())
                .map(str::to_string);

            if let Ok(mut shortcut) = app.state::<RuntimeStatus>().active_shortcut.lock() {
                *shortcut = active_shortcut.clone();
            }

            let toggle_item = MenuItem::with_id(app, "toggle", "显示 / 隐藏", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 LinguaDock", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

            let tray_tooltip = active_shortcut
                .as_deref()
                .map(|shortcut| format!("LinguaDock · {shortcut}"))
                .unwrap_or_else(|| "LinguaDock".to_string());
            let tray_builder = TrayIconBuilder::with_id("linguadock-tray")
                .tooltip(tray_tooltip)
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

            if !launch_hidden {
                show_main_window(app.handle());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            translate_all,
            set_window_pinned,
            hide_main_window,
            start_window_drag,
            resize_main_window,
            get_active_shortcut,
            set_global_shortcut
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
    fn recognises_single_words_without_treating_sentences_as_words() {
        assert!(is_single_word("bank", "en"));
        assert!(is_single_word("mother-in-law", "en"));
        assert!(is_single_word("銀行", "zh-TW"));
        assert!(is_single_word("走る", "ja"));
        assert!(!is_single_word("open the bank", "en"));
        assert!(!is_single_word("你好，世界", "zh-CN"));
    }

    #[test]
    fn validates_shortcuts_between_two_and_five_keys() {
        assert_eq!(normalize_shortcut("ctrl+g").unwrap(), "Ctrl+G");
        assert_eq!(
            normalize_shortcut("control + alt + shift + win + f12").unwrap(),
            "Ctrl+Alt+Shift+Super+F12"
        );
    }

    #[test]
    fn rejects_invalid_shortcut_shapes() {
        assert!(normalize_shortcut("G").is_err());
        assert!(normalize_shortcut("Ctrl+Alt").is_err());
        assert!(normalize_shortcut("Ctrl+G+H").is_err());
        assert!(normalize_shortcut("Ctrl+Ctrl+G").is_err());
        assert!(normalize_shortcut("Ctrl+Alt+Shift+Super+G+H").is_err());
    }

    #[test]
    fn parses_dictionary_senses() {
        let body = r#"[[["银行","bank",null,null,10]],[["noun",["银行","河岸","库"]]],"en"]"#;
        let translation = parse_google_translation(body).unwrap();

        assert_eq!(translation.text, "银行");
        assert_eq!(translation.senses.len(), 1);
        assert_eq!(translation.senses[0].part_of_speech, "noun");
        assert_eq!(translation.senses[0].meanings, ["银行", "河岸", "库"]);
    }

    #[test]
    fn removes_markup_from_dictionary_examples() {
        assert_eq!(
            strip_google_markup("I work at a <b>bank</b> &amp; save money."),
            "I work at a bank & save money."
        );
    }

    #[test]
    #[ignore = "requires a live Google Translate connection"]
    fn translates_with_google_live() {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("Mozilla/5.0 LinguaDock-Test/1.0")
            .build()
            .unwrap();

        let translated = tauri::async_runtime::block_on(translate_one(
            &client,
            "你好，世界",
            "zh-CN",
            "en",
            false,
        ))
        .unwrap();

        assert!(translated.text.to_lowercase().contains("hello"));
    }

    #[test]
    #[ignore = "requires a live Google Translate connection"]
    fn translates_dictionary_details_live() {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("Mozilla/5.0 LinguaDock-Test/1.0")
            .build()
            .unwrap();

        let translated =
            tauri::async_runtime::block_on(translate_one(&client, "bank", "en", "zh-CN", true))
                .unwrap();

        assert!(!translated.senses.is_empty());
        assert!(!translated.examples.is_empty());
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
