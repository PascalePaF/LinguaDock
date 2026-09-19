use std::{
    collections::HashSet,
    env, fs,
    io::Cursor,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{imageops::FilterType, DynamicImage, ImageFormat, RgbaImage};
use serde::Serialize;
use sysinfo::System;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use windows::Media::Ocr::OcrEngine;
use xcap::Monitor;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const PIXPIN_OCR_SCRIPT: &str = "pixpin.screenShot(ShotAction.CopyOcrText)";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Default)]
pub struct CaptureState {
    session: Mutex<Option<CaptureSession>>,
}

struct CaptureSession {
    id: u128,
    captures: Vec<CapturedMonitor>,
    source_hint: String,
    processing: bool,
}

struct CapturedMonitor {
    label: String,
    image: RgbaImage,
    data_url: String,
    scale_factor: f64,
    is_primary: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePayload {
    image_data_url: String,
    image_width: u32,
    image_height: u32,
    scale_factor: f64,
    is_primary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrCapabilities {
    pixpin_detected: bool,
    pixpin_running: bool,
    pixpin_path: Option<String>,
    windows_ocr_available: bool,
    windows_ocr_languages: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixPinLaunch {
    clipboard_sequence: u32,
    executable_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrCompletion {
    text: String,
    engine_label: String,
    language_tag: String,
}

struct TempImage(PathBuf);

impl Drop for TempImage {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn encode_png_data_url(image: &RgbaImage) -> Result<String, String> {
    let mut cursor = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image.clone())
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| format!("无法准备截图选区：{error}"))?;
    Ok(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(cursor.into_inner())
    ))
}

fn close_capture_windows(app: &AppHandle, labels: &[String]) {
    for label in labels {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.close();
        }
    }
}

fn emit_to_main<T: Clone + Serialize>(app: &AppHandle, event: &str, payload: T) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(event, payload);
    }
}

fn restore_main_with_error(app: &AppHandle, message: String) {
    super::show_main_window(app);
    emit_to_main(app, "screenshot-ocr-error", message);
}

fn running_pixpin_path() -> Option<PathBuf> {
    let system = System::new_all();
    system.processes().values().find_map(|process| {
        if !process
            .name()
            .to_string_lossy()
            .eq_ignore_ascii_case("pixpin.exe")
        {
            return None;
        }
        process
            .exe()
            .filter(|path| path.is_file())
            .map(Path::to_path_buf)
    })
}

fn common_pixpin_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(local) = env::var_os("LOCALAPPDATA") {
        paths.push(PathBuf::from(&local).join("PixPin").join("PixPin.exe"));
        paths.push(
            PathBuf::from(local)
                .join("Programs")
                .join("PixPin")
                .join("PixPin.exe"),
        );
    }
    for variable in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = env::var_os(variable) {
            paths.push(PathBuf::from(root).join("PixPin").join("PixPin.exe"));
        }
    }
    paths
}

fn find_pixpin() -> Option<(PathBuf, bool)> {
    if let Some(path) = running_pixpin_path() {
        return Some((path, true));
    }
    common_pixpin_paths()
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| (path, false))
}

fn available_windows_ocr_languages() -> Vec<String> {
    let Ok(languages) = OcrEngine::AvailableRecognizerLanguages() else {
        return Vec::new();
    };
    let Ok(size) = languages.Size() else {
        return Vec::new();
    };
    (0..size)
        .filter_map(|index| languages.GetAt(index).ok())
        .filter_map(|language| language.LanguageTag().ok())
        .map(|tag| tag.to_string_lossy())
        .filter(|tag| !tag.trim().is_empty())
        .collect()
}

#[tauri::command]
pub fn detect_ocr_capabilities() -> OcrCapabilities {
    let running = running_pixpin_path();
    let detected = running
        .clone()
        .map(|path| (path, true))
        .or_else(find_pixpin);
    let languages = available_windows_ocr_languages();
    OcrCapabilities {
        pixpin_detected: detected.is_some(),
        pixpin_running: running.is_some(),
        pixpin_path: detected.map(|(path, _)| path.to_string_lossy().into_owned()),
        windows_ocr_available: !languages.is_empty(),
        windows_ocr_languages: languages,
    }
}

#[tauri::command]
pub fn clipboard_sequence_number() -> u32 {
    #[cfg(target_os = "windows")]
    unsafe {
        windows::Win32::System::DataExchange::GetClipboardSequenceNumber()
    }
    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

#[tauri::command]
pub fn start_pixpin_ocr(app: AppHandle) -> Result<PixPinLaunch, String> {
    let Some((path, was_running)) = find_pixpin() else {
        return Err("未检测到 PixPin，请在设置中改用内置 Windows OCR".into());
    };

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    thread::sleep(Duration::from_millis(160));

    if !was_running {
        let mut launch = Command::new(&path);
        #[cfg(target_os = "windows")]
        launch.creation_flags(CREATE_NO_WINDOW);
        if let Err(error) = launch.spawn() {
            super::show_main_window(&app);
            return Err(format!("无法启动 PixPin：{error}"));
        }
        thread::sleep(Duration::from_millis(1_100));
    }

    let sequence = clipboard_sequence_number();
    let mut command = Command::new(&path);
    command.args(["-r", PIXPIN_OCR_SCRIPT]);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    if let Err(error) = command.spawn() {
        super::show_main_window(&app);
        return Err(format!("无法调用 PixPin OCR：{error}"));
    }

    Ok(PixPinLaunch {
        clipboard_sequence: sequence,
        executable_path: path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn start_builtin_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    source_hint: String,
) -> Result<(), String> {
    {
        let session = state
            .session
            .lock()
            .map_err(|_| "无法读取截图状态".to_string())?;
        if session.is_some() {
            return Err("已经有一个截图任务正在进行".into());
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    thread::sleep(Duration::from_millis(180));

    let monitors = Monitor::all().map_err(|error| {
        super::show_main_window(&app);
        format!("无法读取显示器：{error}")
    })?;
    if monitors.is_empty() {
        super::show_main_window(&app);
        return Err("没有检测到可截图的显示器".into());
    }

    let session_id = timestamp_millis();
    let capture_result = (|| {
        let mut captures = Vec::with_capacity(monitors.len());
        let mut placements = Vec::with_capacity(monitors.len());

        for (index, monitor) in monitors.into_iter().enumerate() {
            let x = monitor
                .x()
                .map_err(|error| format!("无法读取显示器位置：{error}"))?;
            let y = monitor
                .y()
                .map_err(|error| format!("无法读取显示器位置：{error}"))?;
            let width = monitor
                .width()
                .map_err(|error| format!("无法读取显示器尺寸：{error}"))?;
            let height = monitor
                .height()
                .map_err(|error| format!("无法读取显示器尺寸：{error}"))?;
            let scale_factor = monitor.scale_factor().unwrap_or(1.0).max(0.5) as f64;
            let is_primary = monitor.is_primary().unwrap_or(index == 0);
            let image = monitor
                .capture_image()
                .map_err(|error| format!("无法截取显示器画面：{error}"))?;
            let label = format!("capture-{session_id}-{index}");
            let data_url = encode_png_data_url(&image)?;
            placements.push((label.clone(), x, y, width, height, is_primary));
            captures.push(CapturedMonitor {
                label,
                image,
                data_url,
                scale_factor,
                is_primary,
            });
        }
        Ok::<_, String>((captures, placements))
    })();
    let (captures, placements) = match capture_result {
        Ok(captures) => captures,
        Err(message) => {
            super::show_main_window(&app);
            return Err(message);
        }
    };

    {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "无法保存截图状态".to_string())?;
        *session = Some(CaptureSession {
            id: session_id,
            captures,
            source_hint,
            processing: false,
        });
    }

    let mut created = Vec::new();
    let mut primary_label = None;
    for (label, x, y, width, height, is_primary) in placements {
        let window =
            match WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("capture.html".into()))
                .title("译栈 · 截图翻译")
                .decorations(false)
                .transparent(false)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .shadow(false)
                .visible(false)
                .build()
            {
                Ok(window) => window,
                Err(error) => {
                    close_capture_windows(&app, &created);
                    if let Ok(mut session) = state.session.lock() {
                        *session = None;
                    }
                    super::show_main_window(&app);
                    return Err(format!("无法创建截图选区：{error}"));
                }
            };

        let _ = window.set_position(PhysicalPosition::new(x, y));
        let _ = window.set_size(PhysicalSize::new(width, height));
        let _ = window.show();
        if is_primary {
            primary_label = Some(label.clone());
        }
        created.push(label);
    }

    let focus_label = primary_label.or_else(|| created.first().cloned());
    if let Some(label) = focus_label {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_capture_payload(
    window: WebviewWindow,
    state: State<'_, CaptureState>,
) -> Result<CapturePayload, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "无法读取截图状态".to_string())?;
    let session = session
        .as_ref()
        .ok_or_else(|| "截图任务已经结束".to_string())?;
    let capture = session
        .captures
        .iter()
        .find(|capture| capture.label == window.label())
        .ok_or_else(|| "找不到当前显示器的截图".to_string())?;
    Ok(CapturePayload {
        image_data_url: capture.data_url.clone(),
        image_width: capture.image.width(),
        image_height: capture.image.height(),
        scale_factor: capture.scale_factor,
        is_primary: capture.is_primary,
    })
}

fn selection_rect(
    image: &RgbaImage,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(u32, u32, u32, u32), String> {
    if ![x, y, width, height].into_iter().all(f64::is_finite) {
        return Err("截图选区无效".into());
    }
    let left = x.clamp(0.0, 1.0);
    let top = y.clamp(0.0, 1.0);
    let right = (x + width).clamp(0.0, 1.0);
    let bottom = (y + height).clamp(0.0, 1.0);
    if right <= left || bottom <= top {
        return Err("请拖动选择包含文字的区域".into());
    }

    let image_width = image.width();
    let image_height = image.height();
    let pixel_x = (left * image_width as f64).floor() as u32;
    let pixel_y = (top * image_height as f64).floor() as u32;
    let pixel_right = (right * image_width as f64).ceil().min(image_width as f64) as u32;
    let pixel_bottom = (bottom * image_height as f64)
        .ceil()
        .min(image_height as f64) as u32;
    let pixel_width = pixel_right.saturating_sub(pixel_x);
    let pixel_height = pixel_bottom.saturating_sub(pixel_y);
    if pixel_width < 8 || pixel_height < 8 {
        return Err("截图区域太小，请重新框选".into());
    }
    Ok((pixel_x, pixel_y, pixel_width, pixel_height))
}

fn prepare_for_ocr(image: RgbaImage) -> DynamicImage {
    let dynamic = DynamicImage::ImageRgba8(image);
    let largest = dynamic.width().max(dynamic.height());
    if largest == 0 {
        return dynamic;
    }
    let scale = if largest < 900 {
        2.0
    } else if largest > 2_600 {
        2_600.0 / largest as f64
    } else {
        1.0
    };
    if (scale - 1.0_f64).abs() < f64::EPSILON {
        dynamic
    } else {
        dynamic.resize(
            (dynamic.width() as f64 * scale).round().max(1.0) as u32,
            (dynamic.height() as f64 * scale).round().max(1.0) as u32,
            FilterType::Lanczos3,
        )
    }
}

fn normalize_ocr_text(text: &str) -> String {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn ocr_quality(text: &str, language_tag: &str) -> i64 {
    let visible = text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count() as i64;
    let alphanumeric = text
        .chars()
        .filter(|character| character.is_alphanumeric())
        .count() as i64;
    let replacement = text.matches('\u{fffd}').count() as i64;
    let cjk = text
        .chars()
        .filter(|character| {
            matches!(*character as u32, 0x3040..=0x30ff | 0x3400..=0x9fff | 0xf900..=0xfaff)
        })
        .count() as i64;
    let latin = text
        .chars()
        .filter(|character| character.is_ascii_alphabetic())
        .count() as i64;
    let language_bonus = if language_tag.starts_with("ja") && cjk > 0 {
        8
    } else if (language_tag.starts_with("zh") && cjk > 0)
        || (language_tag.starts_with("en") && latin > cjk)
    {
        6
    } else {
        0
    };
    visible + alphanumeric * 2 + language_bonus - replacement * 30
}

fn candidate_languages(source_hint: &str) -> Vec<&'static str> {
    match source_hint {
        "zh-CN" => vec!["zh-Hans-CN"],
        "zh-TW" => vec!["zh-Hant-TW"],
        "ja" => vec!["ja-JP"],
        "en" => vec!["en-US"],
        _ => vec!["zh-Hans-CN", "en-US", "ja-JP", "zh-Hant-TW"],
    }
}

fn recognize_windows_ocr(image: RgbaImage, source_hint: &str) -> Result<OcrCompletion, String> {
    let prepared = prepare_for_ocr(image);
    let mut path = env::temp_dir();
    path.push(format!(
        "linguadock-ocr-{}-{}.png",
        std::process::id(),
        timestamp_millis()
    ));
    prepared
        .save_with_format(&path, ImageFormat::Png)
        .map_err(|error| format!("无法准备 OCR 临时图像：{error}"))?;
    let _guard = TempImage(path.clone());
    let path_text = path.to_string_lossy();

    let mut attempts = Vec::new();
    let mut seen = HashSet::new();
    if source_hint == "auto" {
        if let Ok(text) = win_ocr::ocr(&path_text) {
            let text = normalize_ocr_text(&text);
            if !text.is_empty() {
                seen.insert(text.clone());
                attempts.push((ocr_quality(&text, "system"), "系统首选".to_string(), text));
            }
        }
    }
    for language in candidate_languages(source_hint) {
        if let Ok(text) = win_ocr::ocr_with_lang(&path_text, language) {
            let text = normalize_ocr_text(&text);
            if !text.is_empty() && seen.insert(text.clone()) {
                attempts.push((ocr_quality(&text, language), language.to_string(), text));
            }
        }
    }

    let Some((_, language_tag, text)) = attempts.into_iter().max_by_key(|candidate| candidate.0)
    else {
        return Err(
            "没有识别到文字。可放大后重新框选，或在 Windows 中安装中文、英语、日语 OCR 语言包"
                .into(),
        );
    };

    Ok(OcrCompletion {
        text,
        engine_label: "Windows 本地 OCR".into(),
        language_tag,
    })
}

#[tauri::command]
pub async fn finish_builtin_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let (session_id, cropped, source_hint, labels) = {
        let mut session = state
            .session
            .lock()
            .map_err(|_| "无法读取截图状态".to_string())?;
        let session = session
            .as_mut()
            .ok_or_else(|| "截图任务已经结束".to_string())?;
        if session.processing {
            return Err("正在识别上一选区".into());
        }
        let capture = session
            .captures
            .iter()
            .find(|capture| capture.label == label)
            .ok_or_else(|| "找不到当前显示器的截图".to_string())?;
        let (crop_x, crop_y, crop_width, crop_height) =
            selection_rect(&capture.image, x, y, width, height)?;
        let cropped =
            image::imageops::crop_imm(&capture.image, crop_x, crop_y, crop_width, crop_height)
                .to_image();
        let labels = session
            .captures
            .iter()
            .map(|capture| capture.label.clone())
            .collect::<Vec<_>>();
        session.processing = true;
        (session.id, cropped, session.source_hint.clone(), labels)
    };

    close_capture_windows(&app, &labels);
    let recognition =
        tauri::async_runtime::spawn_blocking(move || recognize_windows_ocr(cropped, &source_hint))
            .await;

    let should_deliver = state
        .session
        .lock()
        .map(|mut active| {
            if active
                .as_ref()
                .is_some_and(|session| session.id == session_id)
            {
                *active = None;
                true
            } else {
                false
            }
        })
        .unwrap_or(false);
    if !should_deliver {
        return Ok(());
    }
    match recognition {
        Ok(Ok(completion)) => {
            super::show_main_window(&app);
            emit_to_main(&app, "screenshot-ocr-complete", completion);
        }
        Ok(Err(message)) => restore_main_with_error(&app, message),
        Err(error) => restore_main_with_error(&app, format!("OCR 任务异常结束：{error}")),
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_builtin_capture(
    app: AppHandle,
    state: State<'_, CaptureState>,
) -> Result<(), String> {
    let labels = state
        .session
        .lock()
        .map_err(|_| "无法读取截图状态".to_string())?
        .take()
        .map(|session| {
            session
                .captures
                .into_iter()
                .map(|capture| capture.label)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    close_capture_windows(&app, &labels);
    super::show_main_window(&app);
    emit_to_main(&app, "screenshot-ocr-cancelled", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_normalized_selection_to_image() {
        let image = RgbaImage::new(1_000, 800);
        assert_eq!(
            selection_rect(&image, -0.1, 0.25, 0.6, 0.5).unwrap(),
            (0, 200, 500, 400)
        );
    }

    #[test]
    fn rejects_tiny_or_invalid_selection() {
        let image = RgbaImage::new(1_000, 800);
        assert!(selection_rect(&image, 0.2, 0.2, 0.001, 0.001).is_err());
        assert!(selection_rect(&image, f64::NAN, 0.2, 0.4, 0.4).is_err());
    }

    #[test]
    fn normalizes_ocr_lines_without_flattening_reading_order() {
        assert_eq!(
            normalize_ocr_text("  第一行\r\n\r\n second  \n"),
            "第一行\nsecond"
        );
    }

    #[test]
    fn maps_source_languages_to_windows_ocr_tags() {
        assert_eq!(candidate_languages("ja"), vec!["ja-JP"]);
        assert_eq!(candidate_languages("zh-TW"), vec!["zh-Hant-TW"]);
        assert_eq!(candidate_languages("auto").len(), 4);
    }

    #[test]
    #[ignore = "requires an interactive Windows desktop and installed OCR language support"]
    fn captures_live_desktop_and_runs_windows_ocr() {
        let monitors = Monitor::all().expect("desktop monitors should be discoverable");
        let monitor = monitors
            .into_iter()
            .find(|monitor| monitor.is_primary().unwrap_or(false))
            .expect("a primary monitor should exist");
        let image = monitor
            .capture_image()
            .expect("the primary monitor should be capturable");
        assert!(image.width() >= 640);
        assert!(image.height() >= 480);
        let result = recognize_windows_ocr(image, "auto")
            .expect("visible desktop text should be recognized by Windows OCR");
        assert!(!result.text.trim().is_empty());
    }
}
