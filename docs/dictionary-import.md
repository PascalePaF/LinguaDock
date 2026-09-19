# 本地词库导入指南

LinguaDock V1.0.3 的词库中心用于导入用户自己拥有或有权使用的词典。所有词条写入当前 Windows 用户的 WebView IndexedDB，不上传到 LinguaDock 服务器；本项目也没有词库中转服务。

## 支持格式

### CSV / TSV

推荐第一行使用 `word,definition`，也识别 `term`、`headword`、`translation`、`meaning`、`词语`、`单词`、`释义`、`译文` 等列名。

```csv
word,definition
bank,"n. 银行；河岸；v. 存入银行"
translation,"n. 翻译；译文"
```

没有表头时，第一列作为词语，第二列作为释义。CSV 支持双引号包裹和双引号转义。

仓库提供了可直接测试的 [`examples/sample-dictionary.csv`](../examples/sample-dictionary.csv)。

### JSON

可以使用数组：

```json
[
  { "word": "bank", "definition": "银行；河岸" },
  { "term": "dock", "translation": "码头；停靠" }
]
```

也可以使用词语到释义的对象：

```json
{
  "bank": "银行；河岸",
  "dock": "码头；停靠"
}
```

### XML / 有道个人单词本

解析器识别 `item`、`entry`、`word-item` 或 `worditem`，并从 `word` / `term` 与 `trans` / `translation` / `definition` / `meaning` 读取内容。`phonetic` 和 `note` 会附加到释义中。

这覆盖常见的有道个人单词本导出 XML。它不等于读取有道安装目录中的商业词典包。

### TXT

每行一条，可使用 Tab、等号或逗号分隔：

```text
bank=银行；河岸
dock	码头；停靠
```

### StarDict

一次选择同名的 `.ifo`、`.idx` 和未压缩 `.dict` 三个文件。当前版本支持 32 位和 64 位索引偏移，不直接解压 `.dict.dz`；请先使用可信工具把它解压为 `.dict`。

StarDict 文件本身仍可能受版权约束。格式可读不代表内容可以重新分发，请遵守词典自带许可。

## 使用步骤

1. 打开顶部“词库”。
2. 选择“导入词库”，可一次选择多个文件；StarDict 请同时选择三个配套文件。
3. 导入完成后，在搜索框输入前缀即可离线查询。
4. 翻译单个词时，如果导入词库中存在完全相同的词条，其释义会显示在四语结果下方。

重复导入同名文件会覆盖具有相同来源、词语和序号的记录，不会无限创建完全相同的主键。

## 限制与保护

- 单个文件最大 96 MB。
- 单次最多写入 150,000 个词条。
- 单条词语最长保留 200 个字符，释义最长保留 12,000 个字符。
- HTML 形式的释义会转为纯文本，避免把导入内容当作可执行页面。
- `.dat`、`.db`、`.npz`、`.7z` 等专有或封装格式只会给出不兼容提示，不读取正文。
- “清空已导入词库”只删除 LinguaDock 自己的 IndexedDB 数据，不会删除原始文件或网易有道翻译资源。

## 有道资源检测

“检测有道资源”会只读扫描默认用户目录，显示发现的文件数量、大小和兼容性说明。商业词典、发音包和 NMT 模型不会被复制到 LinguaDock，也不会被上传。

更完整的技术和授权边界见 [网易有道翻译桌面体验研究](youdao-experience-study.md)。
