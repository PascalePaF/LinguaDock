export interface ImportedDictionaryEntry {
  id: string;
  term: string;
  normalizedTerm: string;
  definition: string;
  source: string;
  importedAt: number;
}

export interface DictionaryImportResult {
  count: number;
  sources: string[];
  warnings: string[];
}

export interface DictionaryStats {
  entries: number;
  sources: number;
}

const DATABASE_NAME = "linguadock-library";
const DATABASE_VERSION = 1;
const STORE_NAME = "dictionaryEntries";
const MAX_FILE_BYTES = 96 * 1024 * 1024;
const MAX_IMPORT_ENTRIES = 150_000;

function normalizeTerm(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function cleanText(value: unknown): string {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join("；");
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (!/[<>]/.test(raw)) return raw.slice(0, 12_000);
  const document = new DOMParser().parseFromString(raw, "text/html");
  return (document.body.textContent ?? raw).replace(/\s+/g, " ").trim().slice(0, 12_000);
}

function makeEntry(
  termValue: unknown,
  definitionValue: unknown,
  source: string,
  sequence: number,
): ImportedDictionaryEntry | null {
  const term = cleanText(termValue).slice(0, 200);
  const definition = cleanText(definitionValue);
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm || !definition) return null;
  return {
    id: `${source}\u0000${normalizedTerm}\u0000${sequence}`,
    term,
    normalizedTerm,
    definition,
    source,
    importedAt: Date.now(),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地词库数据库"));
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!store.indexNames.contains("normalizedTerm")) {
        store.createIndex("normalizedTerm", "normalizedTerm", { unique: false });
      }
      if (!store.indexNames.contains("source")) {
        store.createIndex("source", "source", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeEntries(entries: ImportedDictionaryEntry[]): Promise<void> {
  const database = await openDatabase();
  try {
    for (let start = 0; start < entries.length; start += 1000) {
      const batch = entries.slice(start, start + 1000);
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        batch.forEach((entry) => store.put(entry));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("写入本地词库失败"));
        transaction.onabort = () => reject(transaction.error ?? new Error("写入本地词库被中止"));
      });
    }
  } finally {
    database.close();
  }
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function entriesFromRows(rows: string[][], source: string): ImportedDictionaryEntry[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((value) => normalizeTerm(value));
  const termNames = ["word", "term", "headword", "词语", "单词", "原文"];
  const definitionNames = ["definition", "translation", "meaning", "释义", "译文"];
  const termIndex = header.findIndex((value) => termNames.includes(value));
  const definitionIndex = header.findIndex((value) => definitionNames.includes(value));
  const hasHeader = termIndex >= 0 && definitionIndex >= 0;
  const resolvedTermIndex = hasHeader ? termIndex : 0;
  const resolvedDefinitionIndex = hasHeader ? definitionIndex : 1;
  const entries: ImportedDictionaryEntry[] = [];

  rows.slice(hasHeader ? 1 : 0).forEach((row, index) => {
    const entry = makeEntry(
      row[resolvedTermIndex],
      row[resolvedDefinitionIndex],
      source,
      index,
    );
    if (entry) entries.push(entry);
  });
  return entries;
}

function parseJsonDictionary(text: string, source: string): ImportedDictionaryEntry[] {
  const value = JSON.parse(text) as unknown;
  const entries: ImportedDictionaryEntry[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const record = item as Record<string, unknown>;
      const entry = makeEntry(
        record.word ?? record.term ?? record.headword ?? record.source,
        record.definition ?? record.translation ?? record.meaning ?? record.target,
        source,
        index,
      );
      if (entry) entries.push(entry);
    });
  } else if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([term, definition], index) => {
      const entry = makeEntry(term, definition, source, index);
      if (entry) entries.push(entry);
    });
  }
  return entries;
}

function parseXmlDictionary(text: string, source: string): ImportedDictionaryEntry[] {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("XML 文件格式无法识别");
  const items = Array.from(document.querySelectorAll("item, entry, word-item, worditem"));
  const entries: ImportedDictionaryEntry[] = [];
  items.forEach((item, index) => {
    const term =
      item.querySelector("word, term, headword, source")?.textContent ??
      item.getAttribute("word") ??
      item.getAttribute("term");
    const definitionParts = [
      item.querySelector("trans, translation, definition, meaning, target")?.textContent,
      item.querySelector("phonetic")?.textContent,
      item.querySelector("note")?.textContent,
    ].filter(Boolean);
    const entry = makeEntry(term, definitionParts.join("；"), source, index);
    if (entry) entries.push(entry);
  });
  return entries;
}

function parsePlainDictionary(text: string, source: string): ImportedDictionaryEntry[] {
  const lines = text.split(/\r?\n/);
  const rows = lines.map((line) => {
    const separator = line.includes("\t") ? "\t" : line.includes("=") ? "=" : ",";
    const index = line.indexOf(separator);
    return index >= 0 ? [line.slice(0, index), line.slice(index + 1)] : [line, ""];
  });
  return entriesFromRows(rows, source);
}

function baseName(fileName: string): string {
  return fileName.replace(/\.(ifo|idx|dict)$/i, "");
}

async function parseStarDict(files: File[], sourceBase: string): Promise<ImportedDictionaryEntry[]> {
  const ifoFile = files.find((file) => file.name.toLowerCase().endsWith(".ifo"));
  if (!ifoFile) return [];
  const base = baseName(ifoFile.name).toLocaleLowerCase();
  const idxFile = files.find(
    (file) => file.name.toLocaleLowerCase() === `${base}.idx`,
  );
  const dictFile = files.find(
    (file) => file.name.toLocaleLowerCase() === `${base}.dict`,
  );
  if (!idxFile || !dictFile) {
    throw new Error(`StarDict ${ifoFile.name} 缺少同名 .idx 或未压缩 .dict 文件`);
  }
  if (idxFile.size + dictFile.size > MAX_FILE_BYTES) {
    throw new Error(`StarDict ${ifoFile.name} 超过单次导入大小限制`);
  }

  const metadata = await ifoFile.text();
  const title = metadata.match(/^bookname=(.+)$/im)?.[1]?.trim() || sourceBase;
  const offsetBits = metadata.match(/^idxoffsetbits=(64)$/im) ? 64 : 32;
  const idxBuffer = await idxFile.arrayBuffer();
  const dictBuffer = await dictFile.arrayBuffer();
  const idxBytes = new Uint8Array(idxBuffer);
  const dictBytes = new Uint8Array(dictBuffer);
  const view = new DataView(idxBuffer);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries: ImportedDictionaryEntry[] = [];
  let cursor = 0;

  while (cursor < idxBytes.length && entries.length < MAX_IMPORT_ENTRIES) {
    let wordEnd = cursor;
    while (wordEnd < idxBytes.length && idxBytes[wordEnd] !== 0) wordEnd += 1;
    if (wordEnd >= idxBytes.length) break;
    const term = decoder.decode(idxBytes.slice(cursor, wordEnd));
    cursor = wordEnd + 1;
    const requiredBytes = offsetBits === 64 ? 12 : 8;
    if (cursor + requiredBytes > idxBytes.length) break;
    const offset =
      offsetBits === 64
        ? Number(view.getBigUint64(cursor, false))
        : view.getUint32(cursor, false);
    cursor += offsetBits === 64 ? 8 : 4;
    const size = view.getUint32(cursor, false);
    cursor += 4;
    if (!Number.isSafeInteger(offset) || offset < 0 || size <= 0 || offset + size > dictBytes.length) {
      continue;
    }
    const definition = decoder.decode(dictBytes.slice(offset, offset + size));
    const entry = makeEntry(term, definition, `StarDict · ${title}`, entries.length);
    if (entry) entries.push(entry);
  }
  return entries;
}

function ensureImportLimit(entries: ImportedDictionaryEntry[]): ImportedDictionaryEntry[] {
  if (entries.length > MAX_IMPORT_ENTRIES) return entries.slice(0, MAX_IMPORT_ENTRIES);
  return entries;
}

export async function importDictionaryFiles(fileList: FileList | File[]): Promise<DictionaryImportResult> {
  const files = Array.from(fileList);
  const warnings: string[] = [];
  const imported: ImportedDictionaryEntry[] = [];
  const sources = new Set<string>();
  const consumedStarDict = new Set<string>();

  for (const file of files) {
    if (imported.length >= MAX_IMPORT_ENTRIES) {
      warnings.push(`一次最多导入 ${MAX_IMPORT_ENTRIES.toLocaleString()} 个词条，其余文件已跳过`);
      break;
    }
    if (file.size > MAX_FILE_BYTES) {
      warnings.push(`${file.name} 超过 96 MB，已跳过`);
      continue;
    }
    const name = file.name.toLocaleLowerCase();
    const source = `导入 · ${file.name}`;
    let entries: ImportedDictionaryEntry[] = [];
    try {
      if (name.endsWith(".ifo")) {
        const base = baseName(name);
        if (consumedStarDict.has(base)) continue;
        entries = await parseStarDict(files, file.name);
        consumedStarDict.add(base);
      } else if (name.endsWith(".idx") || name.endsWith(".dict")) {
        continue;
      } else if (name.endsWith(".dict.dz")) {
        warnings.push(`${file.name} 是压缩 StarDict，请先解压为 .dict 后再导入`);
        continue;
      } else if (name.endsWith(".json")) {
        entries = parseJsonDictionary(await file.text(), source);
      } else if (name.endsWith(".csv")) {
        entries = entriesFromRows(parseDelimited(await file.text(), ","), source);
      } else if (name.endsWith(".tsv")) {
        entries = entriesFromRows(parseDelimited(await file.text(), "\t"), source);
      } else if (name.endsWith(".xml")) {
        entries = parseXmlDictionary(await file.text(), source);
      } else if (name.endsWith(".txt")) {
        entries = parsePlainDictionary(await file.text(), source);
      } else if (/\.(dat|db|npz|7z)$/i.test(name)) {
        warnings.push(`${file.name} 属于专有或封装格式，未读取正文`);
        continue;
      } else {
        warnings.push(`${file.name} 的格式暂不支持`);
        continue;
      }
    } catch (error) {
      warnings.push(`${file.name}：${error instanceof Error ? error.message : "解析失败"}`);
      continue;
    }

    entries = ensureImportLimit(entries).slice(0, MAX_IMPORT_ENTRIES - imported.length);
    if (entries.length === 0) {
      warnings.push(`${file.name} 没有找到可导入词条`);
      continue;
    }
    entries.forEach((entry) => sources.add(entry.source));
    imported.push(...entries);
  }

  if (imported.length > 0) await storeEntries(imported);
  return { count: imported.length, sources: Array.from(sources), warnings };
}

export async function lookupDictionary(term: string): Promise<ImportedDictionaryEntry[]> {
  const normalized = normalizeTerm(term);
  if (!normalized) return [];
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).index("normalizedTerm").getAll(normalized, 30);
      request.onsuccess = () => resolve(request.result as ImportedDictionaryEntry[]);
      request.onerror = () => reject(request.error ?? new Error("本地词典查询失败"));
    });
  } finally {
    database.close();
  }
}

export async function searchDictionary(prefix: string, limit = 60): Promise<ImportedDictionaryEntry[]> {
  const normalized = normalizeTerm(prefix);
  if (!normalized) return [];
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const results: ImportedDictionaryEntry[] = [];
      const transaction = database.transaction(STORE_NAME, "readonly");
      const index = transaction.objectStore(STORE_NAME).index("normalizedTerm");
      const request = index.openCursor(IDBKeyRange.bound(normalized, `${normalized}\uffff`));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        results.push(cursor.value as ImportedDictionaryEntry);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error("本地词典搜索失败"));
    });
  } finally {
    database.close();
  }
}

export async function dictionaryStats(): Promise<DictionaryStats> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();
      const sources = new Set<string>();
      const sourceCursor = store.index("source").openKeyCursor();
      sourceCursor.onsuccess = () => {
        const cursor = sourceCursor.result;
        if (!cursor) return;
        sources.add(String(cursor.key));
        cursor.continue();
      };
      transaction.oncomplete = () => {
        resolve({ entries: countRequest.result, sources: sources.size });
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("读取词库统计失败"));
    });
  } finally {
    database.close();
  }
}

export async function clearImportedDictionaries(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("清空本地词库失败"));
    });
  } finally {
    database.close();
  }
}
