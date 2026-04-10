# 简历上传解析功能设计

> 状态：**已定稿**（2026-04-10）

---

## 1. 需求概述

用户上传 PDF 或 docx 格式的简历文件，后端调用本地 Ollama（Qwen 0.6B）将全文一次性解析为结构化模块，写入前端 localStorage 的模块库。

**写入规则：**
- `basic_info`、`skill`：仅在对应类型模块数量为 0 时才写入（防覆盖）
- `summary`：配额未满（<5）才写入
- `experiences`：逐条写入，超配额（10条上限）时停止并提示

---

## 2. 整体架构

```
前端 home.html
  └─ 上传按钮（限 PDF/docx，5MB）
       │  POST /api/resume/parse  multipart/form-data
       ▼
后端 routers/resume_parse.py
  ├─ 文本提取（PDF → pdfplumber，docx → python-docx）
  ├─ services/resume_parse_service.py
  │    ├─ 构建 prompt（全文一次性）
  │    ├─ 调用 Ollama（settings.OLLAMA_BASE_URL，模型 qwen2.5:0.5b）
  │    └─ 解析 JSON → 标准模块结构
  └─ 返回结构化 JSON

前端接收
  ├─ 按写入规则调用 addModule()（来自 resume-store.js）
  └─ toast 提示结果
```

---

## 3. 新增 / 修改文件

| 文件 | 变更 |
|------|------|
| `backend/routers/resume_parse.py` | 新建，定义 POST /api/resume/parse |
| `backend/services/resume_parse_service.py` | 新建，文本提取 + Ollama 调用 + JSON 解析 |
| `backend/schemas/resume_parse.py` | 新建，ParsedResume response schema |
| `backend/config.py` | 新增 `OLLAMA_PARSE_MODEL: str = "qwen2.5:0.5b"` |
| `backend/main.py` | 注册 resume_parse router |
| `pages/home.html` | 新增上传按钮 + `handleResumeUpload()` 函数 |

---

## 4. 后端接口

### `POST /api/resume/parse`

**请求**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
file: <File>  (PDF 或 docx，≤5MB)
```

**响应 200**
```json
{
  "basic_info": {
    "name": "", "phone": "", "email": "", "location": "", "target_role": ""
  },
  "experiences": [
    {
      "module_type": "work_experience",
      "data": { "company": "", "title": "", "start": "", "end": "", "description": "" }
    },
    {
      "module_type": "education",
      "data": { "school": "", "degree": "", "major": "", "start": "", "end": "" }
    }
  ],
  "skill": { "items": [] },
  "summary": { "content": "" }
}
```
各字段解析失败时为 `null`（不抛错）。

**响应 422**：文件格式不支持或超过 5MB

**响应 503**：Ollama 不可用或模型未拉取

---

## 5. Prompt 设计

```
你是简历解析助手。请将以下简历文本解析为 JSON，严格按格式输出，不要解释。

格式：
{
  "basic_info": { "name":"", "phone":"", "email":"", "location":"", "target_role":"" },
  "experiences": [
    {"module_type":"work_experience","data":{"company":"","title":"","start":"","end":"","description":""}},
    {"module_type":"education","data":{"school":"","degree":"","major":"","start":"","end":""}},
    {"module_type":"project","data":{"name":"","role":"","start":"","end":"","description":""}},
    {"module_type":"research","data":{"institution":"","topic":"","start":"","end":"","description":""}},
    {"module_type":"award","data":{"name":"","date":"","issuer":""}},
    {"module_type":"certificate","data":{"name":"","date":"","issuer":""}}
  ],
  "skill": { "items": [] },
  "summary": { "content": "" }
}

简历文本：
{text}
```

**Fallback**：若模型输出无法解析为合法 JSON，各字段降级为 `null`，前端展示"部分解析失败"提示。

---

## 6. 服务层实现要点

```python
# resume_parse_service.py 核心逻辑

async def parse_resume(file_bytes: bytes, filename: str) -> ParsedResume:
    # 1. 提取文本
    text = extract_text(file_bytes, filename)  # PDF/docx 分支

    # 2. 调用 Ollama（OpenAI 兼容接口，非流式）
    client = AsyncOpenAI(base_url=settings.OLLAMA_BASE_URL + "/v1", api_key="ollama")
    response = await client.chat.completions.create(
        model=settings.OLLAMA_PARSE_MODEL,
        messages=[{"role": "user", "content": build_prompt(text)}],
        temperature=0.1,  # 低温保证 JSON 稳定
    )

    # 3. 解析 JSON，失败时 fallback
    return safe_parse_json(response.choices[0].message.content)
```

---

## 7. 前端 UI

**位置**：`home.html` 简历模块库顶部，"新增模块"按钮旁

```
[+ 新增模块]  [↑ 上传简历]
```

**交互流程：**
1. 点击"上传简历" → 触发隐藏 `<input type="file" accept=".pdf,.docx">`
2. 选文件后立即上传，按钮变为 spinner + "解析中…"（禁用防重复）
3. 成功后按写入规则调用 `addModule()`，刷新列表
4. toast 提示："成功导入 X 个模块"
5. 超配额时追加提示："已达上限，部分经历未导入"
6. 503 错误提示："本地模型不可用，请确认 Ollama 已启动并拉取 qwen2.5:0.5b"

**新增函数**（home.html 内联）：
- `handleResumeUpload(file)` — 上传、调接口、写模块、刷新

---

## 8. 依赖

- `pdfplumber`（需 `pip install pdfplumber`，python-docx 已安装）
- Ollama 本地服务已运行，已拉取 `qwen2.5:0.5b`（`ollama pull qwen2.5:0.5b`）
