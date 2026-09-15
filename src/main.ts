import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import "./styles.css";

type LanguageCode = "zh-CN" | "en" | "ja" | "zh-TW";
type SourceChoice = LanguageCode | "auto";
type Theme = "light" | "dark";
type StatusMode = "loading" | "ready" | "error";

interface DictionarySense {
  partOfSpeech: string;
  meanings: string[];
}

interface TranslationItem {
  language: LanguageCode;
  text: string | null;
  error: string | null;
  isOriginal: boolean;
  senses: DictionarySense[];
}

interface TranslationResponse {
  detectedLanguage: LanguageCode;
  isSingleWord: boolean;
  examples: string[];
  items: TranslationItem[];
}

interface CardElements {
  card: HTMLElement;
  output: HTMLElement;
  senses: HTMLElement;
}

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  "zh-CN": "简体中文",
  en: "English",
  ja: "日本語",
  "zh-TW": "繁體中文",
};

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  noun: "名",
  verb: "动",
  adjective: "形",
  adverb: "副",
  pronoun: "代",
  preposition: "介",
  conjunction: "连",
  interjection: "叹",
  article: "冠",
  determiner: "限定",
  abbreviation: "缩写",
  phrase: "短语",
  "auxiliary verb": "助动",
};

const IS_TAURI = "__TAURI_INTERNALS__" in window;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as T;
}

const root = document.documentElement;
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const titlebar = requiredElement<HTMLElement>("titlebar");
const workspace = requiredElement<HTMLElement>("workspace");
const sourceText = requiredElement<HTMLTextAreaElement>("sourceText");
const sourceLanguage = requiredElement<HTMLSelectElement>("sourceLanguage");
const characterCount = requiredElement<HTMLElement>("characterCount");
const clearButton = requiredElement<HTMLButtonElement>("clearButton");
const translateButton = requiredElement<HTMLButtonElement>("translateButton");
const themeButton = requiredElement<HTMLButtonElement>("themeButton");
const pinButton = requiredElement<HTMLButtonElement>("pinButton");
const closeButton = requiredElement<HTMLButtonElement>("closeButton");
const statusRow = requiredElement<HTMLElement>("statusRow");
const statusText = requiredElement<HTMLElement>("statusText");
const resultsPanel = requiredElement<HTMLElement>("resultsPanel");
const wordUsage = requiredElement<HTMLElement>("wordUsage");
const usageList = requiredElement<HTMLUListElement>("usageList");
const toast = requiredElement<HTMLElement>("toast");

const cards = new Map<LanguageCode, CardElements>();
document.querySelectorAll<HTMLElement>(".result-card").forEach((card) => {
  const language = card.dataset.language as LanguageCode | undefined;
  const output = card.querySelector<HTMLElement>(".result-text");
  const senses = card.querySelector<HTMLElement>(".dictionary-senses");
  if (language && output && senses) {
    cards.set(language, { card, output, senses });
  }
});

let debounceTimer: number | undefined;
let toastTimer: number | undefined;
let fitTimer: number | undefined;
let requestSequence = 0;
let isComposing = false;
let isPinned = localStorage.getItem("linguadock.pinned") !== "false";
let activeTheme: Theme =
  localStorage.getItem("linguadock.theme") === "dark" ||
  (localStorage.getItem("linguadock.theme") === null &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light";
let resultComplexity = { longestText: 0, senseCount: 0 };
let lastRequestedSize: { width: number; height: number } | null = null;
const currentResults = new Map<LanguageCode, string>();

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "翻译失败，请检查网络连接后重试";
}

function setStatus(mode: StatusMode, message: string): void {
  statusRow.hidden = false;
  statusRow.classList.remove("is-loading", "is-ready", "is-error");
  statusRow.classList.add(`is-${mode}`);
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

function applyTheme(theme: Theme, persist: boolean): void {
  activeTheme = theme;
  root.dataset.theme = theme;
  const switchLabel = theme === "light" ? "切换到夜间主题" : "切换到日间主题";
  themeButton.title = switchLabel;
  themeButton.ariaLabel = switchLabel;
  if (themeMeta) {
    themeMeta.content = theme === "light" ? "#ffffff" : "#171920";
  }
  if (persist) {
    localStorage.setItem("linguadock.theme", theme);
  }
  queueWindowFit();
}

function resizeTextarea(): void {
  sourceText.style.height = "0px";
  const compactMinimum = window.innerHeight <= 520 ? 58 : 78;
  const nextHeight = Math.min(190, Math.max(compactMinimum, sourceText.scrollHeight));
  sourceText.style.height = `${nextHeight}px`;
}

function visibleWorkspaceHeight(): number {
  const workspaceStyle = window.getComputedStyle(workspace);
  const paddingTop = Number.parseFloat(workspaceStyle.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(workspaceStyle.paddingBottom) || 0;
  const rawGap = Number.parseFloat(workspaceStyle.rowGap);
  const gap = Number.isFinite(rawGap) ? rawGap : 0;
  const children = Array.from(workspace.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      !element.hidden &&
      window.getComputedStyle(element).display !== "none",
  );
  const childHeight = children.reduce(
    (total, element) => total + element.getBoundingClientRect().height,
    0,
  );
  return paddingTop + paddingBottom + childHeight + Math.max(0, children.length - 1) * gap;
}

function desiredWindowWidth(): number {
  if (resultsPanel.hidden) {
    return sourceText.value.length > 240 ? 620 : 560;
  }

  let width = 620;
  if (resultComplexity.senseCount > 0) width += 60;
  if (resultComplexity.longestText > 220) width += 60;
  if (resultComplexity.longestText > 700) width += 80;
  return width;
}

async function fitWindowToContent(): Promise<void> {
  if (!IS_TAURI) return;

  const availableWidth = Math.max(480, Math.floor(window.screen.availWidth * 0.92));
  const availableHeight = Math.max(270, Math.floor(window.screen.availHeight * 0.92));
  const width = Math.round(Math.min(900, availableWidth, desiredWindowWidth()));
  const contentHeight = titlebar.getBoundingClientRect().height + visibleWorkspaceHeight() + 1;
  const height = Math.round(Math.min(900, availableHeight, Math.max(270, contentHeight)));

  if (
    lastRequestedSize &&
    Math.abs(lastRequestedSize.width - width) <= 3 &&
    Math.abs(lastRequestedSize.height - height) <= 3
  ) {
    return;
  }

  const widthChanged =
    lastRequestedSize === null || Math.abs(lastRequestedSize.width - width) > 3;
  lastRequestedSize = { width, height };

  try {
    await invoke("resize_main_window", { width, height });
    if (widthChanged) {
      window.setTimeout(() => queueWindowFit(0), 100);
    }
  } catch (error) {
    console.warn("Unable to fit LinguaDock window", error);
  }
}

function queueWindowFit(delay = 40): void {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      void fitWindowToContent();
    });
  }, delay);
}

function resetCards(): void {
  currentResults.clear();
  resultComplexity = { longestText: 0, senseCount: 0 };
  resultsPanel.hidden = true;
  statusRow.hidden = true;
  wordUsage.hidden = true;
  usageList.replaceChildren();

  cards.forEach(({ card, output, senses }) => {
    card.classList.remove("is-loading", "is-source", "is-error", "is-copied");
    card.classList.add("is-disabled");
    card.setAttribute("aria-disabled", "true");
    output.textContent = "";
    senses.hidden = true;
    senses.replaceChildren();
  });
  queueWindowFit();
}

function setCardsLoading(): void {
  currentResults.clear();
  resultComplexity = { longestText: 0, senseCount: 0 };
  resultsPanel.hidden = false;
  wordUsage.hidden = true;
  usageList.replaceChildren();

  cards.forEach(({ card, output, senses }) => {
    card.classList.remove("is-source", "is-error", "is-copied");
    card.classList.add("is-loading", "is-disabled");
    card.setAttribute("aria-disabled", "true");
    output.textContent = "正在翻译";
    senses.hidden = true;
    senses.replaceChildren();
  });
  queueWindowFit();
}

function updateComposerState(): void {
  const length = Array.from(sourceText.value).length;
  const hasText = sourceText.value.trim().length > 0;
  characterCount.textContent = String(length);
  clearButton.disabled = !hasText;
  translateButton.disabled = !hasText;
  resizeTextarea();
  queueWindowFit();
}

function partOfSpeechLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  return PART_OF_SPEECH_LABELS[normalized] ?? value;
}

function renderSenses(container: HTMLElement, senses: DictionarySense[]): void {
  container.replaceChildren();
  container.hidden = senses.length === 0;

  senses.forEach((sense) => {
    const row = document.createElement("div");
    row.className = "sense-row";

    const part = document.createElement("span");
    part.className = "sense-part";
    part.textContent = partOfSpeechLabel(sense.partOfSpeech);

    const meanings = document.createElement("span");
    meanings.className = "sense-meanings";
    meanings.textContent = sense.meanings.join(" · ");

    row.append(part, meanings);
    container.append(row);
  });
}

function clipboardText(item: TranslationItem): string {
  const lines = [item.text ?? ""];
  item.senses.forEach((sense) => {
    lines.push(`${partOfSpeechLabel(sense.partOfSpeech)}  ${sense.meanings.join("；")}`);
  });
  return lines.filter(Boolean).join("\n");
}

function renderResponse(response: TranslationResponse): void {
  let failedCount = 0;
  let longestText = 0;
  let senseCount = 0;

  response.items.forEach((item) => {
    const elements = cards.get(item.language);
    if (!elements) return;

    const { card, output, senses } = elements;
    card.classList.remove("is-loading", "is-source", "is-error", "is-disabled");
    card.classList.toggle("is-source", item.isOriginal);
    card.setAttribute("aria-disabled", "false");

    if (item.text !== null) {
      output.textContent = item.text;
      renderSenses(senses, item.senses);
      currentResults.set(item.language, clipboardText(item));
      longestText = Math.max(longestText, Array.from(item.text).length);
      senseCount += item.senses.reduce(
        (count, sense) => count + sense.meanings.length,
        0,
      );
    } else {
      failedCount += 1;
      card.classList.add("is-error", "is-disabled");
      card.setAttribute("aria-disabled", "true");
      output.textContent = item.error ?? "翻译失败，请稍后重试";
      senses.hidden = true;
      senses.replaceChildren();
    }
  });

  resultComplexity = { longestText, senseCount };
  usageList.replaceChildren();
  if (response.isSingleWord && response.examples.length > 0) {
    response.examples.forEach((example) => {
      const item = document.createElement("li");
      item.textContent = example;
      usageList.append(item);
    });
    wordUsage.hidden = false;
  } else {
    wordUsage.hidden = true;
  }

  const detected = LANGUAGE_LABELS[response.detectedLanguage];
  if (failedCount === 0) {
    setStatus("ready", `${detected} · 已完成`);
  } else {
    setStatus("error", `${detected} · ${failedCount} 项失败`);
  }
  queueWindowFit();
}

async function translateNow(): Promise<void> {
  window.clearTimeout(debounceTimer);
  const text = sourceText.value.trim();
  if (!text) {
    requestSequence += 1;
    resetCards();
    return;
  }

  const requestId = ++requestSequence;
  setCardsLoading();
  setStatus("loading", "翻译中…");

  if (!IS_TAURI) {
    cards.forEach(({ card, output }) => {
      card.classList.remove("is-loading");
      card.classList.add("is-error", "is-disabled");
      output.textContent = "请在桌面应用中使用";
    });
    setStatus("error", "当前为界面预览");
    queueWindowFit();
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
    cards.forEach(({ card, output, senses }) => {
      card.classList.remove("is-loading", "is-source");
      card.classList.add("is-error", "is-disabled");
      card.setAttribute("aria-disabled", "true");
      output.textContent = message;
      senses.hidden = true;
      senses.replaceChildren();
    });
    setStatus("error", message);
    queueWindowFit();
  }
}

function scheduleTranslation(delay = 620): void {
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
  pinButton.classList.toggle("is-active", isPinned);
  pinButton.title = isPinned ? "取消窗口置顶" : "窗口置顶";
  pinButton.ariaLabel = pinButton.title;
  if (!IS_TAURI) return;

  try {
    await invoke("set_window_pinned", { pinned: isPinned });
    localStorage.setItem("linguadock.pinned", String(isPinned));
    if (notify) showToast(isPinned ? "窗口已置顶" : "已取消置顶");
  } catch (error) {
    isPinned = !isPinned;
    pinButton.classList.toggle("is-active", isPinned);
    showToast(normalizeError(error));
  }
}

async function copyResult(language: LanguageCode): Promise<void> {
  const value = currentResults.get(language);
  const elements = cards.get(language);
  if (!value || !elements) return;

  try {
    if (IS_TAURI) {
      await writeText(value);
    } else {
      await navigator.clipboard.writeText(value);
    }
    elements.card.classList.add("is-copied");
    showToast(`${LANGUAGE_LABELS[language]}已复制`);
    window.setTimeout(() => elements.card.classList.remove("is-copied"), 900);
  } catch (error) {
    showToast(`复制失败：${normalizeError(error)}`);
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
  scheduleTranslation(280);
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

themeButton.addEventListener("click", () => {
  applyTheme(activeTheme === "light" ? "dark" : "light", true);
});

pinButton.addEventListener("click", () => {
  isPinned = !isPinned;
  void applyPinnedState(true);
});

closeButton.addEventListener("click", () => {
  void hideWindow();
});

titlebar.addEventListener("pointerdown", (event) => {
  if (
    !IS_TAURI ||
    event.button !== 0 ||
    (event.target instanceof Element && event.target.closest("button"))
  ) {
    return;
  }
  event.preventDefault();
  void invoke("start_window_drag").catch((error) => {
    console.warn("Unable to start window drag", error);
  });
});

cards.forEach(({ card }, language) => {
  card.addEventListener("click", () => {
    void copyResult(language);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void copyResult(language);
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
  setStatus("error", "当前离线");
  queueWindowFit();
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
        showToast("全局快捷键被占用");
      } else if (shortcut !== "Ctrl+Alt+G") {
        showToast(`已改用 ${shortcut} 唤出窗口`);
      }
    })
    .catch(() => undefined);
}

const previewParameters = new URLSearchParams(window.location.search);
const previewMode = !IS_TAURI && previewParameters.has("preview");
const previewTheme = previewParameters.get("theme");
if (previewMode && (previewTheme === "light" || previewTheme === "dark")) {
  activeTheme = previewTheme;
}

applyTheme(activeTheme, false);
updateComposerState();
resetCards();
void applyPinnedState(false);

if (previewMode) {
  sourceText.value = "bank";
  sourceLanguage.value = "en";
  updateComposerState();
  resultsPanel.hidden = false;
  renderResponse({
    detectedLanguage: "en",
    isSingleWord: true,
    examples: [
      "I need to go to the bank this afternoon.",
      "They sat on the river bank and watched the water.",
    ],
    items: [
      {
        language: "zh-CN",
        text: "银行；岸；库",
        error: null,
        isOriginal: false,
        senses: [
          { partOfSpeech: "noun", meanings: ["银行", "河岸", "库", "储备"] },
          { partOfSpeech: "verb", meanings: ["把钱存入银行", "倾斜飞行", "堆积"] },
        ],
      },
      {
        language: "en",
        text: "bank",
        error: null,
        isOriginal: true,
        senses: [],
      },
      {
        language: "ja",
        text: "銀行；土手",
        error: null,
        isOriginal: false,
        senses: [
          { partOfSpeech: "noun", meanings: ["銀行", "土手", "堤防", "貯蔵"] },
          { partOfSpeech: "verb", meanings: ["預金する", "傾ける"] },
        ],
      },
      {
        language: "zh-TW",
        text: "銀行；岸；庫",
        error: null,
        isOriginal: false,
        senses: [
          { partOfSpeech: "noun", meanings: ["銀行", "河岸", "庫", "儲備"] },
          { partOfSpeech: "verb", meanings: ["存款", "傾斜飛行", "堆積"] },
        ],
      },
    ],
  });
}

window.setTimeout(() => sourceText.focus(), 80);
