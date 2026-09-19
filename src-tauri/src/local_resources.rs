use serde::Serialize;
use std::{env, fs, path::Path};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalResourceFile {
    pub name: String,
    pub category: String,
    pub size_bytes: u64,
    pub compatibility: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalResourceReport {
    pub detected: bool,
    pub base_path: Option<String>,
    pub dictionary_files: Vec<LocalResourceFile>,
    pub model_files: Vec<LocalResourceFile>,
    pub total_size_bytes: u64,
    pub notice: String,
}

fn push_files(directory: &Path, category: &str, output: &mut Vec<LocalResourceFile>, depth: usize) {
    if depth > 5 || output.len() >= 512 {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        if output.len() >= 512 {
            break;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            push_files(&path, category, output, depth + 1);
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };

        let compatibility = match path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "csv" | "tsv" | "txt" | "json" | "xml" | "ifo" | "idx" | "dict" => {
                "可通过开放格式导入".to_string()
            }
            _ => "检测到专有资源，仅展示信息".to_string(),
        };

        output.push(LocalResourceFile {
            name: name.to_string(),
            category: category.to_string(),
            size_bytes: metadata.len(),
            compatibility,
        });
    }
}

fn scan_root(root: &Path) -> LocalResourceReport {
    let dictionary_path = root.join("Dictionary");
    let model_path = root.join("nmt_model");
    let mut dictionary_files = Vec::new();
    let mut model_files = Vec::new();

    push_files(&dictionary_path, "离线词典", &mut dictionary_files, 0);
    push_files(&model_path, "离线翻译模型", &mut model_files, 0);
    dictionary_files.sort_by(|left, right| left.name.cmp(&right.name));
    model_files.sort_by(|left, right| left.name.cmp(&right.name));

    let total_size_bytes = dictionary_files
        .iter()
        .chain(model_files.iter())
        .map(|item| item.size_bytes)
        .sum();
    let detected = !dictionary_files.is_empty() || !model_files.is_empty();

    LocalResourceReport {
        detected,
        base_path: detected.then(|| root.display().to_string()),
        dictionary_files,
        model_files,
        total_size_bytes,
        notice: if detected {
            "已找到网易有道翻译本地资源。词典正文和 NMT 模型属于专有格式与授权内容，译栈不会破解、复制或重新分发；可导入有道导出的个人单词本，以及 CSV、TSV、JSON、XML 和未压缩 StarDict 词典。".into()
        } else {
            "未在默认用户目录找到网易有道翻译资源。仍可导入开放格式词典或个人单词本。".into()
        },
    }
}

#[tauri::command]
pub fn scan_local_dictionary_resources() -> LocalResourceReport {
    let Some(local_app_data) = env::var_os("LOCALAPPDATA") else {
        return LocalResourceReport {
            detected: false,
            base_path: None,
            dictionary_files: Vec::new(),
            model_files: Vec::new(),
            total_size_bytes: 0,
            notice: "无法读取 Windows 本地应用数据目录。仍可导入开放格式词典或个人单词本。".into(),
        };
    };
    scan_root(&Path::new(&local_app_data).join("Yodao").join("DeskDict"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_root_returns_empty_report() {
        let report = scan_root(Path::new("Z:/definitely-missing-linguadock-resource-root"));
        assert!(!report.detected);
        assert!(report.dictionary_files.is_empty());
        assert!(report.model_files.is_empty());
    }
}
