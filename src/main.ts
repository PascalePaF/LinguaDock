import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import "./styles.css";

type LanguageCode = "zh-CN" | "en" | "ja" | "zh-TW";
type SourceChoice = LanguageCode | "auto";
type Theme = "light" | "dark";
type StatusMode = "loading" | "ready" | "error";
type TranslationMode = "smart" | "offline" | "online";
type OfflineEngine = "builtin" | "libretranslate" | "ollama" | "lmstudio";
type OnlineEngine = "google" | "ai";
type TranslationKey = "enter" | "ctrl-enter";

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
  engineLabel: string;
  route: "offline" | "online" | "online-fallback";
}

interface TranslationSettings {
  mode: TranslationMode;
  offlineEngine: OfflineEngine;
  onlineEngine: OnlineEngine;
  smartThreshold: number;
  allowSmartFallback: boolean;
  libreEndpoint: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  lmStudioEndpoint: string;
  lmStudioModel: string;
  aiEndpoint: string;
  aiModel: string;
  translationKey: TranslationKey;
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
const settingsButton = requiredElement<HTMLButtonElement>("settingsButton");
const pinButton = requiredElement<HTMLButtonElement>("pinButton");
const closeButton = requiredElement<HTMLButtonElement>("closeButton");
const updateBadge = requiredElement<HTMLElement>("updateBadge");
const settingsPanel = requiredElement<HTMLElement>("settingsPanel");
const settingsDoneButton = requiredElement<HTMLButtonElement>("settingsDoneButton");
const currentVersionElement = requiredElement<HTMLElement>("currentVersion");
const shortcutRecorder = requiredElement<HTMLButtonElement>("shortcutRecorder");
const shortcutValue = requiredElement<HTMLElement>("shortcutValue");
const shortcutHint = requiredElement<HTMLElement>("shortcutHint");
const shortcutResetButton = requiredElement<HTMLButtonElement>("shortcutResetButton");
const startupToggle = requiredElement<HTMLInputElement>("startupToggle");
const autoUpdateToggle = requiredElement<HTMLInputElement>("autoUpdateToggle");
const updateStatus = requiredElement<HTMLElement>("updateStatus");
const updateButton = requiredElement<HTMLButtonElement>("updateButton");
const updateProgress = requiredElement<HTMLElement>("updateProgress");
const updateProgressBar = requiredElement<HTMLElement>("updateProgressBar");
const statusRow = requiredElement<HTMLElement>("statusRow");
const statusText = requiredElement<HTMLElement>("statusText");
const resultsPanel = requiredElement<HTMLElement>("resultsPanel");
const wordUsage = requiredElement<HTMLElement>("wordUsage");
const usageList = requiredElement<HTMLUListElement>("usageList");
const toast = requiredElement<HTMLElement>("toast");
const translationMode = requiredElement<HTMLSelectElement>("translationMode");
const modeDescription = requiredElement<HTMLElement>("modeDescription");
const smartSettings = requiredElement<HTMLElement>("smartSettings");
const smartThresholdRange = requiredElement<HTMLInputElement>("smartThresholdRange");
const smartThreshold = requiredElement<HTMLInputElement>("smartThreshold");
const smartFallbackToggle = requiredElement<HTMLInputElement>("smartFallbackToggle");
const offlineEngineBlock = requiredElement<HTMLElement>("offlineEngineBlock");
const offlineEngine = requiredElement<HTMLSelectElement>("offlineEngine");
const offlineDescription = requiredElement<HTMLElement>("offlineDescription");
const builtinOfflineNote = requiredElement<HTMLElement>("builtinOfflineNote");
const libreEndpoint = requiredElement<HTMLInputElement>("libreEndpoint");
const ollamaEndpoint = requiredElement<HTMLInputElement>("ollamaEndpoint");
const ollamaModel = requiredElement<HTMLInputElement>("ollamaModel");
const lmStudioEndpoint = requiredElement<HTMLInputElement>("lmStudioEndpoint");
const lmStudioModel = requiredElement<HTMLInputElement>("lmStudioModel");
const onlineEngineBlock = requiredElement<HTMLElement>("onlineEngineBlock");
const onlineEngine = requiredElement<HTMLSelectElement>("onlineEngine");
const onlineDescription = requiredElement<HTMLElement>("onlineDescription");
const aiFields = requiredElement<HTMLElement>("aiFields");
const aiEndpoint = requiredElement<HTMLInputElement>("aiEndpoint");
const aiModel = requiredElement<HTMLInputElement>("aiModel");
const aiApiKey = requiredElement<HTMLInputElement>("aiApiKey");
const apiKeyStatus = requiredElement<HTMLElement>("apiKeyStatus");
const saveApiKeyButton = requiredElement<HTMLButtonElement>("saveApiKeyButton");
const deleteApiKeyButton = requiredElement<HTMLButtonElement>("deleteApiKeyButton");
const testProviderButton = requiredElement<HTMLButtonElement>("testProviderButton");
const providerTestStatus = requiredElement<HTMLElement>("providerTestStatus");
const translationKey = requiredElement<HTMLSelectElement>("translationKey");
const enterBehaviorDescription = requiredElement<HTMLElement>("enterBehaviorDescription");
const translationKeyHint = requiredElement<HTMLElement>("translationKeyHint");
const activeModeChip = requiredElement<HTMLElement>("activeModeChip");
const settingsTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"));
const settingsPages = Array.from(document.querySelectorAll<HTMLElement>("[data-settings-page]"));
const offlineFieldGroups = Array.from(
  document.querySelectorAll<HTMLElement>("[data-offline-field]"),
);

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
let settingsOpen = false;
let recordingShortcut = false;
let isPinned = localStorage.getItem("linguadock.pinned") !== "false";
let activeShortcut = "Ctrl+Alt+G";
let pendingUpdate: Update | null = null;
let checkingUpdate = false;
let installingUpdate = false;
let autoUpdateEnabled = localStorage.getItem("linguadock.autoUpdate") !== "false";
let activeTheme: Theme =
  localStorage.getItem("linguadock.theme") === "dark" ||
  (localStorage.getItem("linguadock.theme") === null &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light";
let resultComplexity = { longestText: 0, senseCount: 0 };
let lastRequestedSize: { width: number; height: number } | null = null;
const currentResults = new Map<LanguageCode, string>();

const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  mode: "smart",
  offlineEngine: "builtin",
  onlineEngine: "google",
  smartThreshold: 40,
  allowSmartFallback: true,
  libreEndpoint: "http://127.0.0.1:5000",
  ollamaEndpoint: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5:3b",
  lmStudioEndpoint: "http://127.0.0.1:1234/v1",
  lmStudioModel: "local-model",
  aiEndpoint: "https://api.openai.com/v1",
  aiModel: "",
  translationKey: "enter",
};

function loadTranslationSettings(): TranslationSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem("linguadock.translationSettings") ?? "{}",
    ) as Partial<TranslationSettings>;
    const merged = { ...DEFAULT_TRANSLATION_SETTINGS, ...stored };
    if (!["smart", "offline", "online"].includes(merged.mode)) merged.mode = "smart";
    if (!["builtin", "libretranslate", "ollama", "lmstudio"].includes(merged.offlineEngine)) {
      merged.offlineEngine = "builtin";
    }
    if (!["google", "ai"].includes(merged.onlineEngine)) merged.onlineEngine = "google";
    if (!["enter", "ctrl-enter"].includes(merged.translationKey)) merged.translationKey = "enter";
    merged.smartThreshold = Math.max(
      1,
      Math.min(500, Number(merged.smartThreshold) || DEFAULT_TRANSLATION_SETTINGS.smartThreshold),
    );
    merged.allowSmartFallback = merged.allowSmartFallback !== false;
    return merged;
  } catch {
    return { ...DEFAULT_TRANSLATION_SETTINGS };
  }
}

let translationSettings = loadTranslationSettings();

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
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

function persistTranslationSettings(): void {
  localStorage.setItem(
    "linguadock.translationSettings",
    JSON.stringify(translationSettings),
  );
}

function translationOptions(): Omit<TranslationSettings, "translationKey"> {
  return {
    mode: translationSettings.mode,
    offlineEngine: translationSettings.offlineEngine,
    onlineEngine: translationSettings.onlineEngine,
    smartThreshold: translationSettings.smartThreshold,
    allowSmartFallback: translationSettings.allowSmartFallback,
    libreEndpoint: translationSettings.libreEndpoint,
    ollamaEndpoint: translationSettings.ollamaEndpoint,
    ollamaModel: translationSettings.ollamaModel,
    lmStudioEndpoint: translationSettings.lmStudioEndpoint,
    lmStudioModel: translationSettings.lmStudioModel,
    aiEndpoint: translationSettings.aiEndpoint,
    aiModel: translationSettings.aiModel,
  };
}

function readTranslationSettingsFromForm(): void {
  translationSettings = {
    mode: translationMode.value as TranslationMode,
    offlineEngine: offlineEngine.value as OfflineEngine,
    onlineEngine: onlineEngine.value as OnlineEngine,
    smartThreshold: Math.max(1, Math.min(500, Number(smartThreshold.value) || 40)),
    allowSmartFallback: smartFallbackToggle.checked,
    libreEndpoint: libreEndpoint.value.trim() || DEFAULT_TRANSLATION_SETTINGS.libreEndpoint,
    ollamaEndpoint: ollamaEndpoint.value.trim() || DEFAULT_TRANSLATION_SETTINGS.ollamaEndpoint,
    ollamaModel: ollamaModel.value.trim(),
    lmStudioEndpoint:
      lmStudioEndpoint.value.trim() || DEFAULT_TRANSLATION_SETTINGS.lmStudioEndpoint,
    lmStudioModel: lmStudioModel.value.trim(),
    aiEndpoint: aiEndpoint.value.trim() || DEFAULT_TRANSLATION_SETTINGS.aiEndpoint,
    aiModel: aiModel.value.trim(),
    translationKey: translationKey.value as TranslationKey,
  };
  persistTranslationSettings();
}

function setModeChip(route?: TranslationResponse["route"]): void {
  activeModeChip.classList.remove("is-offline", "is-online");
  if (route === "offline") {
    activeModeChip.textContent = "离线";
    activeModeChip.classList.add("is-offline");
  } else if (route === "online") {
    activeModeChip.textContent = "在线";
    activeModeChip.classList.add("is-online");
  } else if (route === "online-fallback") {
    activeModeChip.textContent = "智能接力";
    activeModeChip.classList.add("is-online");
  } else if (translationSettings.mode === "offline") {
    activeModeChip.textContent = "仅离线";
    activeModeChip.classList.add("is-offline");
  } else if (translationSettings.mode === "online") {
    activeModeChip.textContent = "仅在线";
    activeModeChip.classList.add("is-online");
  } else {
    activeModeChip.textContent = "智能";
  }
}

function renderTranslationSettings(): void {
  translationMode.value = translationSettings.mode;
  offlineEngine.value = translationSettings.offlineEngine;
  onlineEngine.value = translationSettings.onlineEngine;
  smartThreshold.value = String(translationSettings.smartThreshold);
  smartThresholdRange.value = String(Math.min(200, translationSettings.smartThreshold));
  smartFallbackToggle.checked = translationSettings.allowSmartFallback;
  libreEndpoint.value = translationSettings.libreEndpoint;
  ollamaEndpoint.value = translationSettings.ollamaEndpoint;
  ollamaModel.value = translationSettings.ollamaModel;
  lmStudioEndpoint.value = translationSettings.lmStudioEndpoint;
  lmStudioModel.value = translationSettings.lmStudioModel;
  aiEndpoint.value = translationSettings.aiEndpoint;
  aiModel.value = translationSettings.aiModel;
  translationKey.value = translationSettings.translationKey;

  smartSettings.hidden = translationSettings.mode !== "smart";
  offlineEngineBlock.hidden = translationSettings.mode === "online";
  onlineEngineBlock.hidden = translationSettings.mode === "offline";
  builtinOfflineNote.hidden = translationSettings.offlineEngine !== "builtin";
  offlineFieldGroups.forEach((element) => {
    element.hidden = element.dataset.offlineField !== translationSettings.offlineEngine;
  });
  aiFields.hidden = translationSettings.onlineEngine !== "ai";

  modeDescription.textContent =
    translationSettings.mode === "smart"
      ? `≤ ${translationSettings.smartThreshold} 字离线，更多内容在线`
      : translationSettings.mode === "offline"
        ? "内容只在本机或本地服务中处理"
        : "始终使用所选在线引擎";

  const offlineDescriptions: Record<OfflineEngine, string> = {
    builtin: "基础词典与简繁转换，零配置可用",
    libretranslate: "本机 Argos 神经翻译服务",
    ollama: "使用已下载的 Ollama 本地模型",
    lmstudio: "使用 LM Studio 已加载的本地模型",
  };
  offlineDescription.textContent = offlineDescriptions[translationSettings.offlineEngine];
  onlineDescription.textContent =
    translationSettings.onlineEngine === "google"
      ? "Google 翻译，无需密钥"
      : "OpenAI 兼容接口，支持自定义地址与模型";

  const enterTranslates = translationSettings.translationKey === "enter";
  enterBehaviorDescription.textContent = enterTranslates
    ? "Enter 翻译，Ctrl + Enter 换行"
    : "Ctrl + Enter 翻译，Enter 换行";
  translationKeyHint.textContent = enterTranslates ? "↵" : "Ctrl ↵";
  setModeChip();
  lastRequestedSize = null;
  queueWindowFit();
}

function applyTranslationSettingsChange(translateExisting = true): void {
  readTranslationSettingsFromForm();
  renderTranslationSettings();
  providerTestStatus.textContent = "设置已保存";
  requestSequence += 1;
  if (translateExisting && sourceText.value.trim()) scheduleTranslation(160);
}

function setSettingsTab(tab: string): void {
  settingsTabs.forEach((button) => {
    const active = button.dataset.settingsTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  settingsPages.forEach((page) => {
    page.hidden = page.dataset.settingsPage !== tab;
  });
  lastRequestedSize = null;
  queueWindowFit(0);
}

async function refreshApiKeyState(): Promise<void> {
  if (!IS_TAURI) {
    apiKeyStatus.textContent = "桌面版中安全保存";
    deleteApiKeyButton.disabled = true;
    return;
  }
  try {
    const saved = await invoke<boolean>("has_ai_api_key");
    apiKeyStatus.textContent = saved ? "已安全保存" : "尚未保存";
    deleteApiKeyButton.disabled = !saved;
  } catch (error) {
    apiKeyStatus.textContent = "无法读取";
    console.warn("Unable to read AI credential state", error);
  }
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
  if (settingsOpen) return 680;
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
  const width = Math.round(Math.min(940, availableWidth, desiredWindowWidth()));
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

function formatShortcut(shortcut: string): string {
  return shortcut.split("+").join(" + ");
}

function showActiveShortcut(shortcut: string): void {
  activeShortcut = shortcut;
  shortcutValue.textContent = formatShortcut(shortcut);
  shortcutHint.textContent = "点击录制";
}

function stopShortcutRecording(restore = true): void {
  recordingShortcut = false;
  shortcutRecorder.classList.remove("is-recording");
  shortcutRecorder.setAttribute("aria-pressed", "false");
  if (restore) showActiveShortcut(activeShortcut);
}

function setSettingsOpen(open: boolean): void {
  settingsOpen = open;
  settingsPanel.hidden = !open;
  workspace.classList.toggle("is-settings-open", open);
  settingsButton.classList.toggle("is-active", open);
  settingsButton.setAttribute("aria-expanded", String(open));
  settingsButton.title = open ? "返回翻译" : "设置";
  settingsButton.ariaLabel = settingsButton.title;
  if (!open) {
    stopShortcutRecording();
    window.setTimeout(() => sourceText.focus(), 40);
  } else {
    void refreshAutostartState();
    void refreshApiKeyState();
    window.setTimeout(() => settingsTabs.find((tab) => tab.classList.contains("is-active"))?.focus(), 40);
  }
  lastRequestedSize = null;
  queueWindowFit(0);
}

function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) return event.code;

  const namedKeys: Record<string, string> = {
    Space: "Space",
    Tab: "Tab",
    Enter: "Enter",
    NumpadEnter: "Enter",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
  };
  return namedKeys[event.code] ?? null;
}

async function applyShortcut(shortcut: string, persist: boolean, notify: boolean): Promise<void> {
  if (!IS_TAURI) {
    showActiveShortcut(shortcut);
    return;
  }

  shortcutRecorder.disabled = true;
  shortcutResetButton.disabled = true;
  try {
    const normalized = await invoke<string>("set_global_shortcut", { shortcut });
    showActiveShortcut(normalized);
    if (persist) localStorage.setItem("linguadock.shortcut", normalized);
    if (notify) showToast(`唤出快捷键已设为 ${formatShortcut(normalized)}`);
  } catch (error) {
    showActiveShortcut(activeShortcut);
    throw error;
  } finally {
    shortcutRecorder.disabled = false;
    shortcutResetButton.disabled = false;
  }
}

async function initializeShortcut(): Promise<void> {
  if (!IS_TAURI) return;

  try {
    const runningShortcut = await invoke<string | null>("get_active_shortcut");
    if (runningShortcut) showActiveShortcut(runningShortcut);

    const preferredShortcut = localStorage.getItem("linguadock.shortcut");
    if (preferredShortcut && preferredShortcut !== runningShortcut) {
      try {
        await applyShortcut(preferredShortcut, false, false);
      } catch (error) {
        localStorage.setItem("linguadock.shortcut", activeShortcut);
        showToast(`自定义快捷键不可用：${normalizeError(error)}`);
      }
    } else if (!runningShortcut) {
      shortcutValue.textContent = "未设置";
      shortcutHint.textContent = "默认快捷键被占用";
      showToast("全局快捷键被占用，请在设置中重新指定");
    } else if (runningShortcut !== "Ctrl+Alt+G") {
      showToast(`已改用 ${formatShortcut(runningShortcut)} 显示 / 隐藏窗口`);
    }
  } catch (error) {
    console.warn("Unable to initialize global shortcut", error);
  }
}

async function refreshAutostartState(): Promise<void> {
  if (!IS_TAURI) {
    startupToggle.disabled = true;
    return;
  }

  startupToggle.disabled = true;
  try {
    startupToggle.checked = await isEnabled();
  } catch (error) {
    if (settingsOpen) showToast(`无法读取开机自启状态：${normalizeError(error)}`);
  } finally {
    startupToggle.disabled = false;
  }
}

async function changeAutostart(enabled: boolean): Promise<void> {
  startupToggle.disabled = true;
  try {
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
    startupToggle.checked = await isEnabled();
    showToast(startupToggle.checked ? "已开启开机自启" : "已关闭开机自启");
  } catch (error) {
    startupToggle.checked = !enabled;
    showToast(`设置失败：${normalizeError(error)}`);
  } finally {
    startupToggle.disabled = false;
  }
}

function setUpdateProgress(value: number): void {
  const percent = Math.max(0, Math.min(100, value));
  updateProgressBar.style.width = `${percent}%`;
  updateProgress.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function renderPendingUpdate(update: Update): void {
  updateBadge.hidden = false;
  updateStatus.textContent = `V${update.version} 已发布，可直接更新`;
  updateButton.textContent = `更新到 V${update.version}`;
}

async function checkForUpdates(notify: boolean): Promise<void> {
  if (!IS_TAURI || checkingUpdate || installingUpdate) return;

  checkingUpdate = true;
  updateButton.disabled = true;
  updateButton.textContent = "检查中…";
  updateStatus.textContent = "正在连接 GitHub…";
  try {
    const update = await check({ timeout: 20_000 });
    if (update) {
      if (pendingUpdate && pendingUpdate !== update) {
        void pendingUpdate.close().catch(() => undefined);
      }
      pendingUpdate = update;
      renderPendingUpdate(update);
      showToast(`发现新版本 V${update.version}`);
    } else {
      if (pendingUpdate) {
        void pendingUpdate.close().catch(() => undefined);
        pendingUpdate = null;
      }
      updateBadge.hidden = true;
      updateStatus.textContent = `V${currentVersionElement.textContent} 已是最新版本`;
      updateButton.textContent = "检查更新";
      if (notify) showToast("当前已是最新版本");
    }
  } catch (error) {
    updateStatus.textContent = notify ? "检查失败，请稍后重试" : "暂时无法检查更新";
    updateButton.textContent = "重新检查";
    if (notify) showToast(`检查更新失败：${normalizeError(error)}`);
  } finally {
    checkingUpdate = false;
    updateButton.disabled = false;
    queueWindowFit();
  }
}

async function installPendingUpdate(): Promise<void> {
  if (!pendingUpdate || installingUpdate) return;

  installingUpdate = true;
  updateButton.disabled = true;
  updateButton.textContent = "正在下载…";
  updateProgress.hidden = false;
  setUpdateProgress(0);
  let downloaded = 0;
  let total = 0;

  try {
    await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
        updateStatus.textContent = "正在下载已签名的更新包…";
        setUpdateProgress(total > 0 ? 0 : 12);
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0) {
          setUpdateProgress((downloaded / total) * 100);
          updateStatus.textContent = `正在下载… ${Math.min(100, Math.round((downloaded / total) * 100))}%`;
        } else {
          setUpdateProgress(Math.min(88, 12 + downloaded / 200_000));
        }
      } else {
        setUpdateProgress(100);
        updateStatus.textContent = "下载完成，正在启动安装程序…";
        updateButton.textContent = "正在安装…";
      }
    });
  } catch (error) {
    installingUpdate = false;
    updateButton.disabled = false;
    updateProgress.hidden = true;
    renderPendingUpdate(pendingUpdate);
    showToast(`更新失败：${normalizeError(error)}`);
  }
}

async function initializeVersion(): Promise<void> {
  if (!IS_TAURI) return;
  try {
    currentVersionElement.textContent = await getVersion();
    updateStatus.textContent = `V${currentVersionElement.textContent} 已是最新版本`;
  } catch (error) {
    console.warn("Unable to read application version", error);
  }
}

function resetCards(): void {
  currentResults.clear();
  resultComplexity = { longestText: 0, senseCount: 0 };
  resultsPanel.hidden = true;
  statusRow.hidden = true;
  wordUsage.hidden = true;
  usageList.replaceChildren();
  setModeChip();

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
  setModeChip(response.route);
  if (failedCount === 0) {
    setStatus("ready", `${detected} · ${response.engineLabel} · 已完成`);
  } else {
    setStatus("error", `${detected} · ${response.engineLabel} · ${failedCount} 项失败`);
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
  setStatus("loading", translationSettings.mode === "smart" ? "正在智能选择引擎…" : "翻译中…");

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
      options: translationOptions(),
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

function insertNewlineAtCursor(): void {
  const start = sourceText.selectionStart;
  const end = sourceText.selectionEnd;
  sourceText.setRangeText("\n", start, end, "end");
  sourceText.dispatchEvent(new Event("input", { bubbles: true }));
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
  if (event.key !== "Enter" || isComposing) return;

  if (translationSettings.translationKey === "enter") {
    if (event.ctrlKey) {
      event.preventDefault();
      insertNewlineAtCursor();
    } else if (!event.shiftKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      void translateNow();
    }
  } else if (event.ctrlKey) {
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

settingsButton.addEventListener("click", () => {
  setSettingsOpen(!settingsOpen);
});

settingsDoneButton.addEventListener("click", () => {
  setSettingsOpen(false);
});

settingsTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setSettingsTab(button.dataset.settingsTab ?? "translation");
  });
});

[translationMode, offlineEngine, onlineEngine, translationKey].forEach((select) => {
  select.addEventListener("change", () => applyTranslationSettingsChange());
});

smartFallbackToggle.addEventListener("change", () => applyTranslationSettingsChange());

smartThresholdRange.addEventListener("input", () => {
  smartThreshold.value = smartThresholdRange.value;
  applyTranslationSettingsChange(false);
});

smartThreshold.addEventListener("change", () => {
  const normalized = Math.max(1, Math.min(500, Number(smartThreshold.value) || 40));
  smartThreshold.value = String(normalized);
  applyTranslationSettingsChange();
});

[
  libreEndpoint,
  ollamaEndpoint,
  ollamaModel,
  lmStudioEndpoint,
  lmStudioModel,
  aiEndpoint,
  aiModel,
].forEach((input) => {
  input.addEventListener("change", () => applyTranslationSettingsChange());
});

saveApiKeyButton.addEventListener("click", () => {
  const apiKey = aiApiKey.value.trim();
  if (!apiKey) {
    showToast("请先输入 API 密钥");
    aiApiKey.focus();
    return;
  }
  if (!IS_TAURI) {
    showToast("请在桌面应用中保存密钥");
    return;
  }
  saveApiKeyButton.disabled = true;
  void invoke("save_ai_api_key", { apiKey })
    .then(async () => {
      aiApiKey.value = "";
      await refreshApiKeyState();
      showToast("API 密钥已安全保存");
    })
    .catch((error) => showToast(normalizeError(error)))
    .finally(() => {
      saveApiKeyButton.disabled = false;
    });
});

deleteApiKeyButton.addEventListener("click", () => {
  if (!IS_TAURI) return;
  deleteApiKeyButton.disabled = true;
  void invoke("delete_ai_api_key")
    .then(async () => {
      aiApiKey.value = "";
      await refreshApiKeyState();
      showToast("API 密钥已删除");
    })
    .catch((error) => showToast(normalizeError(error)))
    .finally(() => {
      void refreshApiKeyState();
    });
});

testProviderButton.addEventListener("click", () => {
  readTranslationSettingsFromForm();
  if (!IS_TAURI) {
    providerTestStatus.textContent = "请在桌面应用中测试";
    return;
  }
  testProviderButton.disabled = true;
  testProviderButton.textContent = "测试中…";
  providerTestStatus.textContent = "正在连接当前引擎…";
  void invoke<string>("test_translation_provider", { options: translationOptions() })
    .then((message) => {
      providerTestStatus.textContent = message;
      showToast("翻译引擎连接正常");
    })
    .catch((error) => {
      const message = normalizeError(error);
      providerTestStatus.textContent = message;
      showToast(`测试失败：${message}`);
    })
    .finally(() => {
      testProviderButton.disabled = false;
      testProviderButton.textContent = "测试当前路线";
      queueWindowFit();
    });
});

shortcutRecorder.addEventListener("click", () => {
  if (recordingShortcut) {
    stopShortcutRecording();
    return;
  }
  recordingShortcut = true;
  shortcutRecorder.classList.add("is-recording");
  shortcutRecorder.setAttribute("aria-pressed", "true");
  shortcutValue.textContent = "请按组合键";
  shortcutHint.textContent = "Esc 取消 · 2–5 个按键";
});

shortcutResetButton.addEventListener("click", () => {
  stopShortcutRecording();
  void applyShortcut("Ctrl+Alt+G", true, true).catch((error) => {
    showToast(`恢复失败：${normalizeError(error)}`);
  });
});

startupToggle.addEventListener("change", () => {
  void changeAutostart(startupToggle.checked);
});

autoUpdateToggle.addEventListener("change", () => {
  autoUpdateEnabled = autoUpdateToggle.checked;
  localStorage.setItem("linguadock.autoUpdate", String(autoUpdateEnabled));
  showToast(autoUpdateEnabled ? "已开启自动检查更新" : "已关闭自动检查更新");
  if (autoUpdateEnabled) void checkForUpdates(false);
});

updateButton.addEventListener("click", () => {
  if (pendingUpdate) {
    void installPendingUpdate();
  } else {
    void checkForUpdates(true);
  }
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

window.addEventListener(
  "keydown",
  (event) => {
    if (!recordingShortcut) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;

    if (event.key === "Escape") {
      stopShortcutRecording();
      return;
    }

    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.metaKey) modifiers.push("Super");
    const mainKey = shortcutFromKeyboardEvent(event);
    const keys = mainKey ? [...modifiers, mainKey] : modifiers;

    shortcutValue.textContent = keys.length > 0 ? keys.join(" + ") : "请按组合键";
    if (!mainKey) {
      shortcutHint.textContent = "继续按一个字母、数字或功能键";
      return;
    }
    if (modifiers.length === 0) {
      shortcutHint.textContent = "还需要 Ctrl、Alt、Shift 或 Win 键";
      return;
    }

    const shortcut = [...modifiers, mainKey].join("+");
    stopShortcutRecording(false);
    shortcutHint.textContent = "正在保存…";
    void applyShortcut(shortcut, true, true).catch((error) => {
      showToast(normalizeError(error));
    });
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (settingsOpen) {
      setSettingsOpen(false);
    } else {
      void hideWindow();
    }
  }
});

window.addEventListener("online", () => {
  if (sourceText.value.trim() && translationSettings.mode !== "offline") {
    scheduleTranslation(100);
  }
});

window.addEventListener("offline", () => {
  if (translationSettings.mode === "offline") {
    setStatus("ready", "网络已断开 · 当前仍使用离线引擎");
  } else if (translationSettings.mode === "smart") {
    setStatus("ready", "网络已断开 · 短内容仍可离线翻译");
  } else {
    setStatus("error", "当前离线，请切换到离线模式");
  }
  queueWindowFit();
});

if (IS_TAURI) {
  void listen("focus-input", () => {
    if (settingsOpen) setSettingsOpen(false);
    window.setTimeout(() => {
      sourceText.focus();
      sourceText.setSelectionRange(sourceText.value.length, sourceText.value.length);
    }, 40);
  });
}

const previewParameters = new URLSearchParams(window.location.search);
const previewMode = !IS_TAURI && previewParameters.has("preview");
const previewView = previewParameters.get("preview");
const previewTheme = previewParameters.get("theme");
if (previewMode && (previewTheme === "light" || previewTheme === "dark")) {
  activeTheme = previewTheme;
}

applyTheme(activeTheme, false);
renderTranslationSettings();
setSettingsTab("translation");
autoUpdateToggle.checked = autoUpdateEnabled;
updateComposerState();
resetCards();
void applyPinnedState(false);
void initializeVersion();
void initializeShortcut();
void refreshAutostartState();

if (previewMode && previewView === "settings") {
  setSettingsOpen(true);
  startupToggle.disabled = false;
  startupToggle.checked = true;
  updateStatus.textContent = "V1.0.2 已是最新版本";
} else if (previewMode) {
  sourceText.value = "bank";
  sourceLanguage.value = "en";
  updateComposerState();
  resultsPanel.hidden = false;
  renderResponse({
    detectedLanguage: "en",
    isSingleWord: true,
    engineLabel: "内置词典 · OpenCC",
    route: "offline",
    examples: [
      "I need to go to the bank this afternoon.",
      "They sat on the river bank and watched the water.",
    ],
    items: [
      {
        language: "zh-CN",
        text: "银行；河岸",
        error: null,
        isOriginal: false,
        senses: [
          { partOfSpeech: "noun", meanings: ["银行", "河岸", "库；储备"] },
          { partOfSpeech: "verb", meanings: ["把钱存入银行", "倾斜转弯", "堆积"] },
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
          { partOfSpeech: "noun", meanings: ["銀行", "川岸・土手", "貯蔵"] },
          { partOfSpeech: "verb", meanings: ["預金する", "傾ける", "積み上げる"] },
        ],
      },
      {
        language: "zh-TW",
        text: "銀行；河岸",
        error: null,
        isOriginal: false,
        senses: [
          { partOfSpeech: "noun", meanings: ["銀行", "河岸", "庫；儲備"] },
          { partOfSpeech: "verb", meanings: ["把錢存入銀行", "傾斜轉彎", "堆積"] },
        ],
      },
    ],
  });
}

if (IS_TAURI && autoUpdateEnabled) {
  window.setTimeout(() => void checkForUpdates(false), 1800);
}

if (!settingsOpen) window.setTimeout(() => sourceText.focus(), 80);
