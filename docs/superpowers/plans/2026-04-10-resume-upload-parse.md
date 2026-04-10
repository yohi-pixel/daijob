# Resume Upload Parse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resume file upload (PDF/docx) that extracts text, calls local Ollama Qwen 0.6B to parse it into structured modules, and writes them into the frontend localStorage module library.

**Architecture:** Frontend sends multipart file to `POST /api/resume/parse`; backend extracts text then calls Ollama via OpenAI-compatible client with a one-shot structured JSON prompt; the response is validated and returned; frontend writes each module using existing `addModule()` with quota-aware skip logic.

**Tech Stack:** FastAPI, python-docx, pdfplumber, openai (AsyncOpenAI), Ollama (qwen2.5:0.5b), vanilla JS ES modules

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/config.py` | Modify | Add `OLLAMA_PARSE_MODEL` setting |
| `backend/schemas/resume_parse.py` | Create | Pydantic response schema `ParsedResume` |
| `backend/services/resume_parse_service.py` | Create | Text extraction + Ollama call + JSON fallback |
| `backend/routers/resume_parse.py` | Create | `POST /api/resume/parse` endpoint |
| `backend/main.py` | Modify | Register resume_parse router |
| `pages/home.html` | Modify | Upload button HTML + `handleResumeUpload()` JS |

---

## Task 1: Install pdfplumber and add config setting

**Files:**
- Modify: `backend/config.py`

- [ ] **Step 1: Install pdfplumber**

```bash
pip install pdfplumber
```

Expected output includes: `Successfully installed pdfplumber-...`

- [ ] **Step 2: Add OLLAMA_PARSE_MODEL to config**

In `backend/config.py`, add after `OLLAMA_MODEL`:

```python
OLLAMA_PARSE_MODEL: str = "qwen2.5:0.5b"
```

Full updated `Settings` class:

```python
class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+aiomysql://user:password@localhost:3306/yesjob?charset=utf8mb4"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_PARSE_MODEL: str = "qwen2.5:0.5b"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-plus"
    JOBS_FILE: str = "data/jobs.jsonl"

    class Config:
        env_file = ".env"
```

- [ ] **Step 3: Verify import works**

```bash
cd /d/ayohi/YesJob/backend && python -c "from config import settings; print(settings.OLLAMA_PARSE_MODEL)"
```

Expected: `qwen2.5:0.5b`

- [ ] **Step 4: Commit**

```bash
cd /d/ayohi/YesJob
git add backend/config.py
git commit -m "feat: add OLLAMA_PARSE_MODEL config for resume parsing"
```

---

## Task 2: Create Pydantic schema

**Files:**
- Create: `backend/schemas/resume_parse.py`

- [ ] **Step 1: Create schema file**

```python
# backend/schemas/resume_parse.py
from typing import Any, Optional
from pydantic import BaseModel


class ExperienceModule(BaseModel):
    module_type: str  # work_experience | education | project | research | award | certificate
    data: dict[str, Any]


class ParsedResume(BaseModel):
    basic_info: Optional[dict[str, Any]] = None
    experiences: list[ExperienceModule] = []
    skill: Optional[dict[str, Any]] = None
    summary: Optional[dict[str, Any]] = None
```

- [ ] **Step 2: Verify import**

```bash
cd /d/ayohi/YesJob/backend && python -c "from schemas.resume_parse import ParsedResume; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd /d/ayohi/YesJob
git add backend/schemas/resume_parse.py
git commit -m "feat: add ParsedResume schema for resume upload endpoint"
```

---

## Task 3: Create resume parse service

**Files:**
- Create: `backend/services/resume_parse_service.py`

- [ ] **Step 1: Create service file**

```python
# backend/services/resume_parse_service.py
import io
import json
import re
from typing import Any, Optional

import pdfplumber
import docx
from openai import AsyncOpenAI
from fastapi import HTTPException

from config import settings
from schemas.resume_parse import ExperienceModule, ParsedResume

PARSE_PROMPT_TEMPLATE = """\
你是简历解析助手。请将以下简历文本解析为 JSON，严格按格式输出，不要解释。

格式：
{{
  "basic_info": {{"name":"","phone":"","email":"","location":"","target_role":""}},
  "experiences": [
    {{"module_type":"work_experience","data":{{"company":"","title":"","start":"","end":"","description":""}}}},
    {{"module_type":"education","data":{{"school":"","degree":"","major":"","start":"","end":""}}}},
    {{"module_type":"project","data":{{"name":"","role":"","start":"","end":"","description":""}}}},
    {{"module_type":"research","data":{{"institution":"","topic":"","start":"","end":"","description":""}}}},
    {{"module_type":"award","data":{{"name":"","date":"","issuer":""}}}},
    {{"module_type":"certificate","data":{{"name":"","date":"","issuer":""}}}}
  ],
  "skill": {{"items":[]}},
  "summary": {{"content":""}}
}}

只输出实际存在的经历条目（experiences 列表只包含简历中有的内容），其余字段若无内容则留空字符串。

简历文本：
{text}"""


def _extract_text_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def _extract_text_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()


def extract_text(file_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_text_pdf(file_bytes)
    if lower.endswith(".docx"):
        return _extract_text_docx(file_bytes)
    raise ValueError(f"Unsupported file type: {filename}")


def _extract_json_from_text(text: str) -> Optional[dict]:
    """Try to find and parse JSON object from model output."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract first {...} block
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _safe_parse(raw: dict) -> ParsedResume:
    experiences = []
    for item in raw.get("experiences", []):
        try:
            experiences.append(ExperienceModule(
                module_type=item["module_type"],
                data=item.get("data", {}),
            ))
        except Exception:
            continue
    return ParsedResume(
        basic_info=raw.get("basic_info") or None,
        experiences=experiences,
        skill=raw.get("skill") or None,
        summary=raw.get("summary") or None,
    )


async def parse_resume(file_bytes: bytes, filename: str) -> ParsedResume:
    text = extract_text(file_bytes, filename)
    if not text:
        return ParsedResume()

    # Truncate to ~3000 chars to stay within model context
    text = text[:3000]

    client = AsyncOpenAI(
        base_url=settings.OLLAMA_BASE_URL + "/v1",
        api_key="ollama",
    )
    try:
        response = await client.chat.completions.create(
            model=settings.OLLAMA_PARSE_MODEL,
            messages=[{"role": "user", "content": PARSE_PROMPT_TEMPLATE.format(text=text)}],
            temperature=0.1,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama 不可用: {e}")

    content = response.choices[0].message.content or ""
    raw = _extract_json_from_text(content)
    if not raw:
        # Fallback: return empty parsed resume, don't crash
        return ParsedResume()

    return _safe_parse(raw)
```

- [ ] **Step 2: Verify import**

```bash
cd /d/ayohi/YesJob/backend && python -c "from services.resume_parse_service import parse_resume; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd /d/ayohi/YesJob
git add backend/services/resume_parse_service.py
git commit -m "feat: add resume parse service with Ollama + text extraction"
```

---

## Task 4: Create router and register it

**Files:**
- Create: `backend/routers/resume_parse.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create router file**

```python
# backend/routers/resume_parse.py
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from services.auth_service import get_current_user
from services.resume_parse_service import parse_resume
from schemas.resume_parse import ParsedResume

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/parse", response_model=ParsedResume)
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
):
    suffix = ""
    if file.filename:
        for ext in ALLOWED_EXTENSIONS:
            if file.filename.lower().endswith(ext):
                suffix = ext
                break
    if not suffix:
        raise HTTPException(status_code=422, detail="仅支持 PDF 或 docx 文件")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="文件不得超过 5MB")

    return await parse_resume(file_bytes, file.filename)
```

- [ ] **Step 2: Register router in main.py**

In `backend/main.py`, add import and include_router:

```python
from routers import auth, jobs, ai, resume_parse
```

And after the existing `app.include_router(ai.router, ...)` line:

```python
app.include_router(resume_parse.router, prefix="/api/resume", tags=["resume"])
```

- [ ] **Step 3: Restart backend and verify endpoint appears**

```bash
cd /d/ayohi/YesJob/backend && python -m uvicorn main:app --reload --port 8000 &
sleep 3
curl -s http://localhost:8000/docs | grep -o 'resume/parse' | head -1
```

Expected: `resume/parse`

- [ ] **Step 4: Commit**

```bash
cd /d/ayohi/YesJob
git add backend/routers/resume_parse.py backend/main.py
git commit -m "feat: add POST /api/resume/parse endpoint"
```

---

## Task 5: Add frontend upload button and handler

**Files:**
- Modify: `pages/home.html`

- [ ] **Step 1: Add hidden file input and upload button HTML**

In `pages/home.html`, find the `addModuleBtn` button block (around line 332):

```html
              <button id="addModuleBtn"
                class="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold active:scale-95 transition-all hover:shadow-md hover:shadow-primary/20">
                <span class="material-symbols-outlined text-base">add</span>新增
              </button>
```

Replace with:

```html
              <div class="flex items-center gap-2">
                <button id="addModuleBtn"
                  class="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold active:scale-95 transition-all hover:shadow-md hover:shadow-primary/20">
                  <span class="material-symbols-outlined text-base">add</span>新增
                </button>
                <input id="resumeFileInput" type="file" accept=".pdf,.docx" class="hidden" />
                <button id="uploadResumeBtn"
                  class="flex items-center gap-1.5 px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-sm font-bold active:scale-95 transition-all hover:shadow-md border border-outline-variant">
                  <span class="material-symbols-outlined text-base">upload_file</span>上传简历
                </button>
              </div>
```

- [ ] **Step 2: Add handleResumeUpload function and event binding**

In `pages/home.html`, find the `showToast` function (around line 1659). Add the following **before** `showToast`:

```javascript
async function handleResumeUpload(file) {
  const btn = document.getElementById('uploadResumeBtn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span>解析中…';

  try {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const resp = await fetch('/api/resume/parse', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    if (resp.status === 503) {
      showToast('本地模型不可用，请确认 Ollama 已启动并拉取 qwen2.5:0.5b');
      return;
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast(`解析失败：${err.detail || resp.status}`);
      return;
    }

    const result = await resp.json();
    let imported = 0;
    let quotaHit = false;

    // basic_info: only if none exists
    if (result.basic_info && getModulesByType('basic_info').length === 0) {
      try { addModule('basic_info', result.basic_info); imported++; } catch {}
    }

    // experiences: write until quota
    for (const exp of (result.experiences || [])) {
      try {
        addModule(exp.module_type, exp.data);
        imported++;
      } catch (e) {
        if (e.message && e.message.includes('最多')) { quotaHit = true; break; }
      }
    }

    // skill: only if none exists
    if (result.skill && getModulesByType('skill').length === 0) {
      try { addModule('skill', result.skill); imported++; } catch {}
    }

    // summary: write if under quota
    if (result.summary) {
      try { addModule('summary', result.summary); imported++; } catch {}
    }

    renderModuleList();
    showToast(imported > 0 ? `成功导入 ${imported} 个模块` : '未解析到有效内容');
    if (quotaHit) setTimeout(() => showToast('已达上限，部分经历未导入'), 1800);

  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}
```

- [ ] **Step 3: Bind upload button events in bindResumeEvents**

In `bindResumeEvents()` (around line 1322), after the existing `addModuleBtn` event listener line:

```javascript
  document.getElementById('addModuleBtn')?.addEventListener('click', openAddForm);
```

Add:

```javascript
  document.getElementById('uploadResumeBtn')?.addEventListener('click', () => {
    document.getElementById('resumeFileInput').click();
  });
  document.getElementById('resumeFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) { e.target.value = ''; handleResumeUpload(file); }
  });
```

- [ ] **Step 4: Verify getModulesByType is imported**

Check that `getModulesByType` is already in the import from `resume-store.js` (line ~511):

```bash
grep 'getModulesByType' /d/ayohi/YesJob/pages/home.html | head -3
```

Expected: at least one line showing it's imported or used.

- [ ] **Step 5: Commit**

```bash
cd /d/ayohi/YesJob
git add pages/home.html
git commit -m "feat: add resume upload button and handleResumeUpload() to home.html"
```

---

## Task 6: Pull Ollama model and end-to-end verify

**Files:** none (runtime verification)

- [ ] **Step 1: Pull qwen2.5:0.5b if not already pulled**

```bash
ollama pull qwen2.5:0.5b
```

Expected: model downloaded or already present.

- [ ] **Step 2: Restart backend**

Kill any running uvicorn, then:

```bash
cd /d/ayohi/YesJob/backend && python -m uvicorn main:app --port 8000 &
sleep 3
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Test parse endpoint with a sample docx (unauthenticated, expect 401)**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/resume/parse \
  -F "file=@/d/ayohi/YesJob/docs/superpowers/specs/2026-04-10-resume-upload-parse-design.md"
```

Expected: `401` (auth required — confirms endpoint is registered)

- [ ] **Step 4: Open browser and test full flow**

1. Open `http://localhost:3000`
2. Log in
3. Switch to 简历 tab
4. Click "上传简历", select a PDF or docx resume file
5. Confirm button shows "解析中…" spinner
6. Confirm toast shows "成功导入 X 个模块"
7. Confirm modules appear in the list

- [ ] **Step 5: Verify basic_info skip logic**

1. Ensure at least one `basic_info` module already exists
2. Upload the same resume again
3. Confirm no additional `basic_info` module is created (count stays the same)
