# AI 功能全景

五类 AI 能力，分布在 4 个 service。模型策略统一为**降级链**：DeepSeek → Qwen → 503。

## 1. 能力总览

| 能力 | 端点 | Service | 模型 | 模式 |
|---|---|---|---|---|
| 简历匹配打分 | `/api/ai/match` | ollama_service | Ollama 本地 (llama3.2:3b) | 并发批处理 |
| 整份简历优化 | `/api/ai/optimize` | llm_service | DeepSeek/Qwen | 一次性 |
| 单模块优化 | `/api/ai/optimize-module` | llm_service | DeepSeek/Qwen | SSE 流式 |
| 求职对话助手 | `/api/ai/chat` | chat_service | DeepSeek/Qwen | SSE 流式 |
| 画像提取 | （chat 内部） | chat_service | DeepSeek/Qwen | 对话后异步 |
| 岗位推荐 | `/api/ai/recommend-jobs` | semantic_vector_service | BGE-small-zh-v1.5 | 向量召回 |
| 岗位契合分析 | `/api/ai/analyze-job-fit` | chat_service | DeepSeek/Qwen | SSE 流式 |
| 简历模块提取 | `/api/ai/extract-resume` | chat_service | DeepSeek/Qwen | 一次性 |

## 2. 模型选择逻辑

### 通用 LLM（chat_service / llm_service）
```python
if DEEPSEEK_API_KEY:  → AsyncOpenAI(deepseek.com/v1, model="deepseek-chat")
elif QWEN_API_KEY:    → AsyncOpenAI(dashscope compatible-mode, model="qwen-plus")
else:                 → 无服务，返回提示 / 503
```
调用侧 try DeepSeek，异常则 fallback Qwen，双失败抛 503。

### Ollama（ollama_service，匹配打分专用）
- `POST {OLLAMA_BASE_URL}/api/generate`，model=`llama3.2:3b`，stream=False，timeout 10s
- Prompt 要求只返回 0-100 整数；非 0-100 整数或异常 → 该岗位得分 null
- `batch_match` 用 `asyncio.gather` 并发，单点失败不影响整体

## 3. 各能力实现细节

### 3.1 简历匹配（Ollama）
Prompt 结构：职位（名称/类别/职责/要求）+ 简历 → "返回 0-100 整数"。
无 LLM 判断，纯文本解析 `int(response)`。

### 3.2 简历优化（llm_service）
- 整份：Prompt 含目标 JD + 简历，要求 STAR 法则重写、加量化、Markdown 输出，末尾附 JSON `{"suggestions": [...]}`
- 解析：正则 `\{"suggestions"\s*:\s*(\[.*?\])\s*\}` 提取建议数组，其余为优化后简历
- 单模块：9 种模块类型（`MODULE_TYPE_LABELS`：基本信息/工作经历/项目/科研/教育/技能/奖项/证书/自我描述），**保持 JSON 结构只改文字**，可选附带目标 JD 上下文（截断 1500 字）

### 3.3 求职对话（chat_service）
- **角色**：AI 助手"小逮"，通过多轮对话收集：基本信息 → 求职意向 → 技能栈 → 经历
- **对话原则**（System Prompt）：每次只问 1-2 个问题；不编造；信息足够时输出 `[PROFILE_READY]` 标记
- **流式**：SSE，`[PROFILE_READY]` 从 content 中剥离，单独发 `{"profile_ready": true}`
- **画像提取**：`[PROFILE_READY]` 或历史 ≥6 条时，用 `EXTRACT_PROMPT`（结构化 JSON schema）异步提取，写入 profile_json
- **历史窗口**：最近 20 条对话存 `user_profiles.conversation_history`
- 已有简历时通过 `context` 注入，避免重复询问

### 3.4 岗位推荐（semantic_vector_service）
```
画像 → build_profile_query()（目标岗位+技能+经历描述拼串）
  → 全量 jobs 转文档（title+responsibilities+requirements+bonus_points，截断 500 字）
  → 向量相似度 → top_k 排序 → JobSummary
```
画像不足时 400"请先与小助手对话"；向量服务不可用 503。

### 3.5 岗位契合分析（chat_service）
`ANALYZE_JOB_FIT_PROMPT`：画像 × JD → 技能匹配度 + 经历亮点 + 3-5 条优化建议（每条 ≤2 句），SSE 流式。

### 3.6 简历模块提取（chat_service）
`EXTRACT_RESUME_PROMPT`：从最近 20 条对话提取 basic/education/experience/project/skill 模块数组，JSON 解析失败返回空数组。

## 4. 配置项（config.py）

| Key | 默认值 | 用途 |
|---|---|---|
| DEEPSEEK_API_KEY / BASE_URL | 空 / api.deepseek.com/v1 | 主 LLM |
| QWEN_API_KEY / BASE_URL / MODEL | 空 / dashscope / qwen-plus | 备 LLM |
| OLLAMA_BASE_URL / MODEL | localhost:11434 / llama3.2:3b | 本地匹配打分 |
| OLLAMA_PARSE_MODEL | qwen2.5:0.5b | （预留，当前未用） |
| EMBEDDING_MODEL | BAAI/bge-small-zh-v1.5 | 向量检索 |
| AI_INVITE_CODE | AYOHI2026 | AI 功能门槛（⚠️ 生产必改） |
| ACCESS_TOKEN_EXPIRE_MINUTES | 60 | JWT 有效期 |

## 5. 安全与降级设计

- **邀请码门禁**：chat / recommend-jobs / analyze-job-fit / extract-resume 必须 `ai_invite_verified`，否则 403
- **优雅降级**：AI 服务全挂时，对话返回"AI 服务未配置"提示而非崩溃；向量挂 → TF-IDF；Ollama 挂 → 匹配分 null
- **文本上限**：resume_text ≤5000 字符、推荐文档截断 500 字、JD 上下文截断 1500 字、分析 prompt 各段截断 300/200 字——控 token 成本
