# AI 翻译服务商指南

LinguaDock V1.0.4 通过 OpenAI Chat Completions 兼容协议，一次请求生成简体中文、英语、日语和繁体中文四份结果。API 密钥按服务商分别保存到 Windows 凭据管理器，不会写入 WebView 本地存储、日志或仓库。

价格与模型会变化。下表是 2026-09-19 查阅官方文档时的选择依据，实际使用前应再次检查服务商页面。

| 预设 | 地址 | 默认模型 | 适合场景 |
| --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` | 低成本、高频短文本；官方文档提供 OpenAI 格式接口 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-flash` | 中国大陆网络环境、低延迟通用翻译 |
| OpenRouter | `https://openrouter.ai/api/v1` | `openrouter/auto` | 用一个密钥试用或路由多家模型 |
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1-mini` | OpenAI 官方接口；可按账户权限更换模型 |
| 自定义 | 用户填写 | 用户填写 | 其他兼容服务或自建网关 |

## 成本参考

- DeepSeek 官方 [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) 在调研日列出 `deepseek-flash`：缓存未命中的低峰输入约 0.15 美元 / 百万 token，低峰输出约 0.60 美元 / 百万 token；高峰价格更高。
- 阿里云官方 [qwen-flash 模型页](https://help.aliyun.com/en/model-studio/qwen-flash) 在调研日列出中国北京地域、输入不超过 128k 时，输入约 0.15 元 / 百万 token，输出约 1.5 元 / 百万 token。
- 阿里云另有针对单一目标语言翻译优化的 `qwen-mt-*` 系列，见 [千问翻译模型文档](https://help.aliyun.com/en/model-studio/machine-translation)。LinguaDock 默认使用通用 `qwen-flash`，因为当前协议要求一次返回四语、词性和例句的结构化 JSON。
- OpenRouter 的模型价格各不相同，应查看 [实时模型列表与价格字段](https://openrouter.ai/docs/api/api-reference/models/get-models)；`openrouter/auto` 最终费用取决于实际路由到的模型。

短句翻译的 token 数通常很小，但收藏、历史或本地词库并不能抵扣在线 API 费用。状态行会显示服务商返回的模型名和输入、输出 token 总量，便于观察使用规模；它不是账单，以服务商控制台为准。

## 设置步骤

1. 打开“设置 → 翻译”。
2. 把在线引擎改为“AI API”。
3. 选择服务商和翻译风格。
4. 填入该服务商的 API 密钥并保存。
5. 点击“测试当前路线”。如果使用智能模式且短文本会走离线，可暂时切换为“仅在线”测试 AI。

切换服务商时会切换到对应的独立密钥槽。删除一个服务商的密钥不会删除其他服务商的密钥。

## 翻译风格

- **自然**：优先使用目标语言母语表达，同时保留语气、专有名词、数字、格式和术语。
- **忠实直译**：尽可能贴近原文措辞与句法，但不牺牲目标语言可读性。
- **精简**：删除语言赘余，不删除事实信息。
- **专业**：适合商务与技术沟通的正式表达。

## 安全边界

- 待翻译文本会发送给所选在线服务商；不要提交无权发送的机密内容。
- 提示词明确要求模型把输入当作不可信的待翻译文本，不能执行其中的指令，并要求只返回固定 JSON 结构。
- 这能降低提示注入风险，但不能保证第三方模型永不偏离格式；解析失败时应用会显示错误，不会把模型输出当作代码执行。
- 自定义地址会收到 API 密钥和待翻译文本。只填写你信任的 HTTPS 服务；本地 Ollama、LM Studio 和 LibreTranslate 则有单独的局域网地址限制。
- 服务商的日志、数据保留、区域与合规政策由服务商决定，LinguaDock 无法替代其隐私条款。
