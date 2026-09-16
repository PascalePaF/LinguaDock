mod translation;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, State, WebviewWindow,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

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
            width.clamp(480.0, 940.0),
            height.clamp(270.0, 920.0),
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
        let _ = tray.set_tooltip(Some(format!("译栈 LinguaDock · {normalized}")));
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
                        toggle_main_window(app);
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
            let quit_item =
                MenuItem::with_id(app, "quit", "退出译栈 LinguaDock", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

            let tray_tooltip = active_shortcut
                .as_deref()
                .map(|shortcut| format!("译栈 LinguaDock · {shortcut}"))
                .unwrap_or_else(|| "译栈 LinguaDock".to_string());
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
                        toggle_main_window(tray.app_handle());
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
            translation::translate_all,
            translation::test_translation_provider,
            translation::save_ai_api_key,
            translation::has_ai_api_key,
            translation::delete_ai_api_key,
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
}
