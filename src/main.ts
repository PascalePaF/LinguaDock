import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import "./styles.css";

type LanguageCode = "zh-CN" | "en" | "ja" | "zh-TW";
type SourceChoice = LanguageCode | "auto";

interface TranslationItem {
  language: LanguageCode;
  text: string | null;
  error: string | null;
  isOriginal: boolean;
}

interface TranslationResponse {
  detectedLanguage: LanguageCode;
  items: TranslationItem[];
}

interface CardElements {
  card: HTMLElement;
  output: HTMLElement;
  copy: HTMLButtonElement;
}

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  "zh-CN": "简体中文",
  en: "English",
  ja: "日本語",
  "zh-TW": "繁體中文",
};

const IS_TAURI = "__TAURI_INTERNALS__" in window;

const PLACEHOLDERS: Record<LanguageCode, string> = {
  "zh-CN": "等待翻译…",
  en: "Waiting…",
  ja: "翻訳を待っています…",
  "zh-TW": "等待翻譯…",
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as T;
}

const sourceText = requiredElement<HTMLTextAreaElement>("sourceText");
const sourceLanguage = requiredElement<HTMLSelectElement>("sourceLanguage");
const characterCount = requiredElement<HTMLElement>("characterCount");
const clearButton = requiredElement<HTMLButtonElement>("clearButton");
const translateButton = requiredElement<HTMLButtonElement>("translateButton");
const pinButton = requiredElement<HTMLButtonElement>("pinButton");
const hideButton = requiredElement<HTMLButtonElement>("hideButton");
const closeButton = requiredElement<HTMLButtonElement>("closeButton");
const shortcutPill = requiredElement<HTMLElement>("shortcutPill");
const statusRow = requiredElement<HTMLElement>("statusRow");
const statusText = requiredElement<HTMLElement>("statusText");
const toast = requiredElement<HTMLElement>("toast");

const cards = new Map<LanguageCode, CardElements>();
document.querySelectorAll<HTMLElement>(".result-card").forEach((card) => {
  const language = card.dataset.language as LanguageCode | undefined;
  const output = card.querySelector<HTMLElement>(".result-text");
  const copy = card.querySelector<HTMLButtonElement>(".copy-button");
  if (language && output && copy) {
    cards.set(language, { card, output, copy });
  }
});

let debounceTimer: number | undefined;
let toastTimer: number | undefined;
let requestSequence = 0;
let isComposing = false;
let isPinned = localStorage.getItem("linguadock.pinned") !== "false";
const currentResults = new Map<LanguageCode, string>();

function setStatus(mode: "idle" | "loading" | "ready" | "error", message: string): void {
  statusRow.classList.remove("is-loading", "is-ready", "is-error");
  if (mode !== "idle") {
    statusRow.classList.add(`is-${mode}`);
  }
  statusText.textContent = message;
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1600);
}

function resetCards(): void {
  currentResults.clear();
  cards.forEach(({ card, output, copy }, language) => {
    card.classList.remove("is-loading", "is-source", "is-error");
    output.classList.add("is-placeholder");
    output.textContent = PLACEHOLDERS[language];
    copy.disabled = true;
  });
}

function setCardsLoading(): void {
  currentResults.clear();
  cards.forEach(({ card, output, copy }) => {
    card.classList.remove("is-source", "is-error");
    card.classList.add("is-loading");
    output.classList.remove("is-placeholder");
    output.textContent = "正在翻译";
    copy.disabled = true;
  });
}

function updateComposerState(): void {
  const length = Array.from(sourceText.value).length;
  const hasText = sourceText.value.trim().length > 0;
  characterCount.textContent = String(length);
  clearButton.disabled = !hasText;
  translateButton.disabled = !hasText;
}

function renderResponse(response: TranslationResponse): void {
  let failedCount = 0;

  response.items.forEach((item) => {
    const elements = cards.get(item.language);
    if (!elements) return;

    const { card, output, copy } = elements;
    card.classList.remove("is-loading", "is-source", "is-error");
    card.classList.toggle("is-source", item.isOriginal);
    output.classList.remove("is-placeholder");

    if (item.text !== null) {
      output.textContent = item.text;
      copy.disabled = false;
      currentResults.set(item.language, item.text);
    } else {
      failedCount += 1;
      card.classList.add("is-error");
      output.textContent = item.error ?? "翻译失败，请稍后重试";
      copy.disabled = true;
    }
  });

  const detected = LANGUAGE_LABELS[response.detectedLanguage];
  if (failedCount === 0) {
    setStatus("ready", `已识别为 ${detected} · 四语结果已更新`);
  } else {
    setStatus("error", `已识别为 ${detected} · ${failedCount} 项翻译失败`);
  }
}

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "翻译失败，请检查网络连接后重试";
}

async function translateNow(): Promise<void> {
  window.clearTimeout(debounceTimer);
  const text = sourceText.value.trim();
  if (!text) {
    requestSequence += 1;
    resetCards();
    setStatus("idle", "等待输入内容");
    return;
  }

  const requestId = ++requestSequence;
  setCardsLoading();
  setStatus("loading", "正在生成四语对照…");

  if (!IS_TAURI) {
    cards.forEach(({ card, output }) => {
      card.classList.remove("is-loading");
      output.classList.add("is-placeholder");
      output.textContent = "请在 LinguaDock 桌面应用中使用翻译";
    });
    setStatus("idle", "浏览器预览模式");
    return;
  }

  try {
    const response = await invoke<TranslationResponse>("translate_all", {
      text,
      sourceHint: sourceLanguage.value as SourceChoice,
    });
    if (requestId !== requestSequence) return;
    renderResponse(response);
  } catch (error) {
    if (requestId !== requestSequence) return;
    const message = normalizeError(error);
    cards.forEach(({ card, output, copy }) => {
      card.classList.remove("is-loading", "is-source");
      card.classList.add("is-error");
      output.classList.remove("is-placeholder");
      output.textContent = message;
      copy.disabled = true;
    });
    setStatus("error", message);
  }
}

function scheduleTranslation(delay = 520): void {
  window.clearTimeout(debounceTimer);
  if (!sourceText.value.trim()) {
    void translateNow();
    return;
  }
  debounceTimer = window.setTimeout(() => {
    void translateNow();
  }, delay);
}

async function hideWindow(): Promise<void> {
  if (!IS_TAURI) return;
  try {
    await invoke("hide_main_window");
  } catch (error) {
    showToast(normalizeError(error));
  }
}

async function applyPinnedState(notify: boolean): Promise<void> {
  if (!IS_TAURI) {
    pinButton.classList.toggle("is-active", isPinned);
    return;
  }
  try {
    await invoke("set_window_pinned", { pinned: isPinned });
    pinButton.classList.toggle("is-active", isPinned);
    pinButton.title = isPinned ? "取消窗口置顶" : "窗口置顶";
    pinButton.ariaLabel = pinButton.title;
    localStorage.setItem("linguadock.pinned", String(isPinned));
    if (notify) showToast(isPinned ? "窗口已置顶" : "已取消置顶");
  } catch (error) {
    isPinned = !isPinned;
    showToast(normalizeError(error));
  }
}

sourceText.addEventListener("compositionstart", () => {
  isComposing = true;
  requestSequence += 1;
  window.clearTimeout(debounceTimer);
});

sourceText.addEventListener("compositionend", () => {
  isComposing = false;
  updateComposerState();
  scheduleTranslation(260);
});

sourceText.addEventListener("input", () => {
  requestSequence += 1;
  updateComposerState();
  if (!isComposing) scheduleTranslation();
});

sourceText.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    void translateNow();
  }
});

sourceLanguage.addEventListener("change", () => {
  requestSequence += 1;
  if (sourceText.value.trim()) scheduleTranslation(100);
});

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  updateComposerState();
  void translateNow();
  sourceText.focus();
});

translateButton.addEventListener("click", () => {
  void translateNow();
});

pinButton.addEventListener("click", () => {
  isPinned = !isPinned;
  void applyPinnedState(true);
});

hideButton.addEventListener("click", () => {
  void hideWindow();
});

closeButton.addEventListener("click", () => {
  void hideWindow();
});

cards.forEach(({ copy }, language) => {
  copy.addEventListener("click", async () => {
    const value = currentResults.get(language);
    if (!value) return;
    try {
      await writeText(value);
      copy.classList.add("is-copied");
      showToast(`${LANGUAGE_LABELS[language]}已复制`);
      window.setTimeout(() => copy.classList.remove("is-copied"), 900);
    } catch (error) {
      showToast(`复制失败：${normalizeError(error)}`);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    void hideWindow();
  }
});

window.addEventListener("online", () => {
  if (sourceText.value.trim()) scheduleTranslation(100);
});

window.addEventListener("offline", () => {
  setStatus("error", "当前处于离线状态");
});

if (IS_TAURI) {
  void listen("focus-input", () => {
    window.setTimeout(() => {
      sourceText.focus();
      sourceText.setSelectionRange(sourceText.value.length, sourceText.value.length);
    }, 40);
  });

  void invoke<string | null>("get_active_shortcut")
    .then((shortcut) => {
      if (!shortcut) {
        shortcutPill.replaceChildren(document.createTextNode("快捷键已被占用"));
        shortcutPill.title = "默认和备用全局快捷键均被其他应用占用";
        return;
      }

      const parts = shortcut.split("+");
      const nodes: Node[] = [];
      parts.forEach((part, index) => {
        if (index > 0) {
          const separator = document.createElement("i");
          separator.textContent = "+";
          nodes.push(separator);
        }
        const key = document.createElement("kbd");
        key.textContent = part;
        nodes.push(key);
      });
      shortcutPill.replaceChildren(...nodes);
      shortcutPill.title = `在任意应用中按 ${shortcut} 唤出 LinguaDock`;
      if (shortcut !== "Ctrl+Alt+G") {
        showToast(`默认快捷键被占用，已改用 ${shortcut}`);
      }
    })
    .catch(() => {
      shortcutPill.replaceChildren(document.createTextNode("快捷键状态未知"));
    });
}

updateComposerState();
resetCards();
void applyPinnedState(false);
window.setTimeout(() => sourceText.focus(), 80);
