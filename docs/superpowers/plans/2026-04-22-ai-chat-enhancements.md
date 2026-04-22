# AI 聊天增强功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 YesJob AI 助手添加全屏聊天模式、简历数据集成（读取/保存/优化）、像素精灵拖拽功能

**Architecture:** 前端单一组件管理多视图（弹窗/全屏），通过 CSS 类切换状态；简历数据从 localStorage 读取并注入到对话 context；后端新增 LLM 提取接口将对话转为结构化简历模块；精灵拖拽通过 mousedown/mousemove 实现临时位置调整

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + AsyncOpenAI (DeepSeek) + Vanilla JS + Canvas API + localStorage

---

## 文件结构

### 修改文件
- `js/pixel-assistant.js` - 主要修改：全屏模式 CSS/切换逻辑、精灵拖拽、简历注入、保存/优化界面
- `backend/services/chat_service.py` - 修改 `chat_stream()` 支持 context 注入
- `backend/routers/ai.py` - 新增 `/extract-resume` 端点，修改 `/analyze-job-fit` 返回 `rewritten_modules`
- `backend/schemas/ai.py` - 新增请求/响应 schema

---

## Task 1: 全屏模式 CSS 和切换逻辑

**Files:**
- Modify: `js/pixel-assistant.js:77-128` (CSS 部分)
- Modify: `js/pixel-assistant.js:73-450` (DOM 结构和事件绑定)

- [ ] **Step 1: 添加全屏模式 CSS**

在 `#pixelAssistant` 的 `<style>` 标签内，`#paWindow` 规则后追加：

```css
#paWindow.fullscreen {
  bottom: 0;
  right: 0;
  left: 0;
  top: 0;
  width: 100%;
  max-height: 100%;
  border-radius: 0;
  display: grid;
  grid-template-columns: 60% 40%;
  grid-template-rows: auto 1fr auto;
}
#paWindow.fullscreen #paHeader {
  grid-column: 1 / -1;
}
#paWindow.fullscreen #paMessages {
  grid-column: 1;
  grid-row: 2;
}
#paWindow.fullscreen #paRecommendSection {
  grid-column: 2;
  grid-row: 2;
  border-top: none;
  border-left: 1px solid #f0f1ef;
  max-height: none;
}
#paWindow.fullscreen #paInputArea {
  grid-column: 1 / -1;
  grid-row: 3;
}
```

- [ ] **Step 2: 修改头部 HTML 添加展开按钮**

在 `createAssistantDOM()` 函数中，找到 `#paHeader` 的 innerHTML，在关闭按钮前添加展开按钮：

```javascript
<div style="display: flex; gap: 8px;">
  <button id="paExpandBtn" title="展开全屏">⛶</button>
  <button id="paCloseBtn">✕</button>
</div>
```

同时在 CSS 中添加展开按钮样式（在 `#paCloseBtn` 规则后）：

```css
#paExpandBtn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  opacity: 0.8;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}
#paExpandBtn:hover { opacity: 1; }
```

- [ ] **Step 3: 添加全屏切换逻辑**

在 `initPixelAssistant()` 函数末尾，添加展开按钮事件监听：

```javascript
let isFullscreen = false;
const expandBtn = document.getElementById('paExpandBtn');
const closeBtn = document.getElementById('paCloseBtn');

expandBtn.addEventListener('click', () => {
  isFullscreen = !isFullscreen;
  paWindow.classList.toggle('fullscreen', isFullscreen);
  expandBtn.textContent = isFullscreen ? '✕' : '⛶';
  expandBtn.title = isFullscreen ? '退出全屏' : '展开全屏';
  
  // 滚动到最新消息
  const messages = document.getElementById('paMessages');
  messages.scrollTop = messages.scrollHeight;
});
```

- [ ] **Step 4: 手动测试全屏切换**

启动前端服务器，打开浏览器：
1. 点击精灵打开对话窗口
2. 点击头部展开按钮（⛶）
3. 验证：窗口全屏显示，左侧消息列表，右侧推荐区域
4. 点击退出全屏按钮（✕）
5. 验证：恢复弹窗模式

预期：切换流畅，消息列表和输入框内容保持不变

- [ ] **Step 5: 提交全屏模式功能**

```bash
cd D:/ayohi/YesJob
git add js/pixel-assistant.js
git commit -m "feat(ai): add fullscreen chat mode with toggle button"
```

---

## Task 2: 像素精灵拖拽

**Files:**
- Modify: `js/pixel-assistant.js:86-93` (精灵样式)
- Modify: `js/pixel-assistant.js:400-450` (事件绑定区域)

- [ ] **Step 1: 添加精灵拖拽状态变量**

在 `initPixelAssistant()` 函数开头添加拖拽状态：

```javascript
let spriteDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let spriteStartLeft = 0;
let spriteStartBottom = 0;
```

- [ ] **Step 2: 实现精灵拖拽逻辑**

在精灵点击事件监听器之前添加拖拽事件：

```javascript
const sprite = document.getElementById('paSprite');
const assistant = document.getElementById('pixelAssistant');

sprite.addEventListener('mousedown', (e) => {
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const rect = assistant.getBoundingClientRect();
  spriteStartLeft = rect.left;
  spriteStartBottom = window.innerHeight - rect.bottom;
  spriteDragging = false;
});

document.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    spriteDragging = true;
    const newLeft = Math.max(0, Math.min(spriteStartLeft + dx, window.innerWidth - 48));
    const newBottom = Math.max(0, Math.min(spriteStartBottom - dy, window.innerHeight - 72));
    assistant.style.left = newLeft + 'px';
    assistant.style.right = 'auto';
    assistant.style.bottom = newBottom + 'px';
  }
});
```

- [ ] **Step 3: 处理点击和拖拽的冲突**

修改精灵的现有点击事件监听器（`canvas.addEventListener('click', ...)`），在回调开头添加拖拽检测：

```javascript
canvas.addEventListener('click', async () => {
  if (spriteDragging) return; // 拖拽中不触发点击
  // ... 原有代码保持不变
```

- [ ] **Step 4: 手动测试拖拽功能**

1. 点击精灵验证对话窗口正常打开（点击行为不变）
2. 拖拽精灵到屏幕左上角，验证位置更新
3. 拖拽到屏幕边缘，验证不超出视口
4. 刷新页面，验证精灵恢复默认右下角位置

预期：拖拽顺滑，边界正确，刷新后恢复默认

- [ ] **Step 5: 提交精灵拖拽功能**

```bash
git add js/pixel-assistant.js
git commit -m "feat(ai): add draggable pixel sprite"
```

---

## Task 3: 后端支持 context 注入

**Files:**
- Modify: `backend/services/chat_service.py:65-70` (`_build_messages` 函数)
- Modify: `backend/schemas/ai.py:30-32` (`ChatRequest`)

- [ ] **Step 1: 扩展 ChatRequest schema**

修改 `backend/schemas/ai.py` 中的 `ChatRequest`：

```python
class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    context: str = ""  # 用户已有简历信息摘要
```

- [ ] **Step 2: 修改 `_build_messages` 支持 context 注入**

修改 `backend/services/chat_service.py` 中的 `_build_messages` 函数：

```python
def _build_messages(history: list[dict], user_message: str, context: str = "") -> list[dict]:
    system_content = SYSTEM_PROMPT
    if context:
        system_content += f"\n\n用户已有简历信息（勿重复询问已知信息）：\n{context}"
    messages = [{"role": "system", "content": system_content}]
    for turn in history[-20:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages
```

- [ ] **Step 3: 修改 `chat_stream` 接受 context 参数**

修改 `backend/services/chat_service.py` 中的 `chat_stream` 函数签名：

```python
async def chat_stream(user_id: int, message: str, db: AsyncSession, context: str = "") -> AsyncGenerator[str, None]:
    profile_row, data = await _get_or_create_profile(user_id, db)
    history: list[dict] = data.get("conversation_history", [])
    # ...
    messages = _build_messages(history, message, context)
```

- [ ] **Step 4: 修改 chat 路由传递 context**

修改 `backend/routers/ai.py` 中的 `chat_endpoint`：

```python
@router.post("/chat")
async def chat_endpoint(
    body: ChatRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    return StreamingResponse(
        chat_stream(user_id, body.message, db, body.context),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 5: 提交后端 context 支持**

```bash
cd D:/ayohi/YesJob
git add backend/schemas/ai.py backend/services/chat_service.py backend/routers/ai.py
git commit -m "feat(backend): support resume context injection in chat"
```

---

## Task 4: 前端读取简历并注入 context

**Files:**
- Modify: `js/pixel-assistant.js:400-407` (打开对话窗口逻辑)
- Modify: `js/pixel-assistant.js:464-535` (`sendMessage` 函数)

- [ ] **Step 1: 添加简历数据读取函数**

在 `initPixelAssistant()` 函数顶部添加（在变量声明之后）：

```javascript
function buildResumeContext() {
  try {
    const raw = localStorage.getItem('yesjob_resume_modules');
    if (!raw) return '';
    const modules = JSON.parse(raw).filter(m => !m.is_deleted);
    if (!modules.length) return '';
    const lines = [];
    modules.forEach(m => {
      const d = m.data || {};
      switch (m.module_type) {
        case 'basic_info':
          lines.push(`基本信息：姓名${d.name || '未知'}，学历${d.education_level || ''}，专业${d.major || ''}，毕业${d.graduation_year || ''}`);
          break;
        case 'experience':
          lines.push(`经历：${d.company || d.org || ''}，${d.role || d.position || ''}，${d.period || ''}，${(d.description || '').slice(0, 80)}`);
          break;
        case 'education':
          lines.push(`教育：${d.school || ''}，${d.degree || ''}，${d.major || ''}，${d.graduation || ''}`);
          break;
        case 'skill':
          lines.push(`技能：${(d.skills || d.items || []).join('、')}`);
          break;
        case 'award':
          lines.push(`奖项：${d.name || d.title || ''}，${d.period || ''}`);
          break;
        case 'summary':
          lines.push(`自我描述：${(d.content || '').slice(0, 100)}`);
          break;
      }
    });
    return lines.join('\n');
  } catch {
    return '';
  }
}
```

- [ ] **Step 2: 修改 `sendMessage` 注入 context**

在 `sendMessage` 函数内，找到发送 `/api/ai/chat` 的 `fetch` 调用，修改 body 加入 context（仅在首条消息时注入）：

```javascript
// 在 sendMessage 函数内，找到 fetch('/api/ai/chat', ...) 调用，修改 body：
body: JSON.stringify({
  message: text,
  context: messages.children.length <= 1 ? buildResumeContext() : '',
}),
```

说明：`messages.children.length <= 1` 表示这是发送的第一条用户消息（对话刚开始），仅在此时注入简历数据

- [ ] **Step 3: 手动测试简历注入**

前提：在简历模块中保存一些测试数据（基本信息、经历）

1. 打开 AI 对话窗口
2. 发送第一条消息
3. 在浏览器开发者工具 Network 标签中查看 `/api/ai/chat` 请求
4. 验证 request body 中包含 `"context": "基本信息：..."`
5. 验证 AI 回复中不重复询问已知信息

预期：context 字段包含格式化的简历摘要

- [ ] **Step 4: 提交前端简历注入**

```bash
git add js/pixel-assistant.js
git commit -m "feat(ai): inject existing resume data as context on chat start"
```

---

## Task 5: 后端新增简历提取接口

**Files:**
- Modify: `backend/schemas/ai.py` (新增 schema)
- Modify: `backend/services/chat_service.py` (新增提取函数)
- Modify: `backend/routers/ai.py` (新增路由)

- [ ] **Step 1: 新增 ExtractResumeRequest schema**

在 `backend/schemas/ai.py` 末尾添加：

```python
class ExtractResumeRequest(BaseModel):
    pass  # 从后端 profile 对话历史提取，不需要前端传历史

class ExtractedModule(BaseModel):
    module_type: str
    data: dict[str, Any]

class ExtractResumeResponse(BaseModel):
    modules: list[ExtractedModule]
```

- [ ] **Step 2: 新增 EXTRACT_RESUME_PROMPT**

在 `backend/services/chat_service.py` 末尾添加：

```python
EXTRACT_RESUME_PROMPT = """根据以下对话历史，提取用户的简历模块信息，以 JSON 格式输出。只提取对话中明确提到的信息，不要编造。

对话历史：
{history}

请输出以下格式的 JSON 数组（每个模块一个对象，只包含有内容的模块）：
[
  {{
    "module_type": "basic_info",
    "data": {{"name": "", "education_level": "", "major": "", "graduation_year": "", "phone": "", "email": "", "location": ""}}
  }},
  {{
    "module_type": "experience",
    "data": {{"company": "", "role": "", "period": "", "description": ""}}
  }},
  {{
    "module_type": "education",
    "data": {{"school": "", "degree": "", "major": "", "graduation": ""}}
  }},
  {{
    "module_type": "skill",
    "data": {{"items": []}}
  }},
  {{
    "module_type": "award",
    "data": {{"title": "", "org": "", "period": ""}}
  }}
]

只输出 JSON 数组，不要任何解释。如果某个模块无数据，不要包含该模块。"""


async def extract_resume_modules(user_id: int, db: AsyncSession) -> list[dict]:
    _, data = await _get_or_create_profile(user_id, db)
    history = data.get("conversation_history", [])
    if not history:
        return []
    llm = _get_llm_client()
    if llm is None:
        return []
    client, model = llm
    history_text = "\n".join(f"{t['role']}: {t['content']}" for t in history[-20:])
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": EXTRACT_RESUME_PROMPT.format(history=history_text)}],
            temperature=0.1,
            max_tokens=1000,
        )
        raw = resp.choices[0].message.content or ""
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        modules = json.loads(raw)
        return [m for m in modules if isinstance(m, dict) and m.get("data")]
    except Exception:
        return []
```

- [ ] **Step 3: 新增路由**

在 `backend/routers/ai.py` 末尾添加（同时在顶部 import 中添加 `extract_resume_modules` 和 `ExtractResumeRequest`、`ExtractResumeResponse`）：

先修改 import 行：
```python
from services.chat_service import chat_stream, get_profile, build_profile_query, analyze_job_fit_stream, extract_resume_modules
from schemas.ai import MatchRequest, MatchResponse, OptimizeRequest, OptimizeResponse, OptimizeModuleRequest, ChatRequest, RecommendRequest, AnalyzeJobFitRequest, InviteCodeRequest, ExtractResumeRequest, ExtractResumeResponse
```

然后在文件末尾添加路由：
```python
@router.post("/extract-resume", response_model=ExtractResumeResponse)
async def extract_resume_endpoint(
    body: ExtractResumeRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_ai_invite(user_id, db)
    modules = await extract_resume_modules(user_id, db)
    return ExtractResumeResponse(modules=modules)
```

- [ ] **Step 4: 手动验证提取接口**

启动后端，在浏览器 console 中执行：

```javascript
fetch('/api/ai/extract-resume', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('yesjob_token')}`
  },
  body: JSON.stringify({})
}).then(r => r.json()).then(console.log)
```

预期：返回 `{ "modules": [...] }`，内容基于已有对话历史

- [ ] **Step 5: 提交后端提取接口**

```bash
git add backend/schemas/ai.py backend/services/chat_service.py backend/routers/ai.py
git commit -m "feat(backend): add /extract-resume endpoint for structured resume extraction"
```

---

## Task 6: 前端"保存到简历"按钮和预览界面

**Files:**
- Modify: `js/pixel-assistant.js` (新增 UI 和逻辑)

- [ ] **Step 1: 添加"保存到简历"按钮 CSS**

在 CSS 样式块末尾（`#paSendBtn:disabled` 规则之后）追加：

```css
#paSaveResumeBtn {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  color: #9d3d00;
  border: 1px solid #9d3d00;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  margin: 4px 0;
  transition: all 0.15s;
}
#paSaveResumeBtn:hover { background: #9d3d00; color: white; }
#paExtractOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
#paExtractOverlay.hidden { display: none; }
#paExtractModal {
  background: white;
  border-radius: 16px;
  padding: 20px;
  max-width: 480px;
  width: 90%;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2);
}
.pa-extract-module {
  border: 1px solid #e0e1df;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}
.pa-extract-module label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}
.pa-extract-module-title {
  font-size: 12px;
  font-weight: 700;
  color: #9d3d00;
  margin-bottom: 6px;
}
.pa-extract-module-content {
  font-size: 12px;
  color: #5a5c5b;
  line-height: 1.6;
  white-space: pre-wrap;
}
```

- [ ] **Step 2: 添加"保存到简历"按钮到 DOM**

在 `createAssistantDOM()` 函数的 `#paInputArea` 之前插入：

```html
<div id="paSaveResumeArea" class="hidden" style="padding: 0 12px 8px; flex-shrink: 0;">
  <button id="paSaveResumeBtn">💾 保存到简历模块</button>
</div>
```

以及提取预览遮罩（追加到 `#paWindow` 之后，作为独立顶层元素）：

```html
<div id="paExtractOverlay" class="hidden">
  <div id="paExtractModal">
    <div style="font-size:15px;font-weight:700;color:#2d2f2e;margin-bottom:12px;">从对话中提取到以下信息</div>
    <div id="paExtractList"></div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button id="paExtractConfirmBtn" style="flex:1;padding:10px;background:#9d3d00;color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;">保存选中项</button>
      <button id="paExtractCancelBtn" style="flex:1;padding:10px;background:#f0f1ef;color:#2d2f2e;border:none;border-radius:10px;cursor:pointer;font-size:13px;">取消</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 实现保存到简历的完整逻辑**

在 `initPixelAssistant()` 中添加：

```javascript
const MODULE_TYPE_LABELS = {
  basic_info: '基本信息',
  experience: '经历',
  education: '教育经历',
  skill: '技能',
  award: '奖项荣誉',
  summary: '自我描述',
};

function formatModulePreview(m) {
  const d = m.data || {};
  switch (m.module_type) {
    case 'basic_info': return `姓名：${d.name || ''}\n学历：${d.education_level || ''} ${d.major || ''}\n毕业：${d.graduation_year || ''}`;
    case 'experience': return `公司：${d.company || ''}\n职位：${d.role || ''}\n时间：${d.period || ''}\n描述：${(d.description || '').slice(0, 100)}`;
    case 'education': return `学校：${d.school || ''}\n学位：${d.degree || ''} ${d.major || ''}\n毕业：${d.graduation || ''}`;
    case 'skill': return `技能：${(d.items || []).join('、')}`;
    case 'award': return `奖项：${d.title || ''}\n颁发：${d.org || ''} ${d.period || ''}`;
    case 'summary': return d.content || '';
    default: return JSON.stringify(d, null, 2);
  }
}

const saveResumeArea = document.getElementById('paSaveResumeArea');
const saveResumeBtn = document.getElementById('paSaveResumeBtn');
const extractOverlay = document.getElementById('paExtractOverlay');
const extractList = document.getElementById('paExtractList');
const extractConfirmBtn = document.getElementById('paExtractConfirmBtn');
const extractCancelBtn = document.getElementById('paExtractCancelBtn');

let extractedModules = [];

saveResumeBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('yesjob_token');
  if (!token) { addBotMessage('请先登录才能保存简历信息'); return; }
  saveResumeBtn.disabled = true;
  saveResumeBtn.textContent = '提取中...';
  try {
    const resp = await fetch('/api/ai/extract-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (!resp.ok) { addBotMessage('提取失败，请检查对话内容后重试'); return; }
    const data = await resp.json();
    extractedModules = data.modules || [];
    if (!extractedModules.length) { addBotMessage('暂未从对话中提取到有效信息，请继续和我聊聊你的情况～'); return; }
    extractList.innerHTML = extractedModules.map((m, i) => `
      <div class="pa-extract-module">
        <label>
          <input type="checkbox" checked data-index="${i}" style="margin-top:3px;flex-shrink:0;">
          <div>
            <div class="pa-extract-module-title">${MODULE_TYPE_LABELS[m.module_type] || m.module_type}</div>
            <div class="pa-extract-module-content">${escText(formatModulePreview(m))}</div>
          </div>
        </label>
      </div>
    `).join('');
    extractOverlay.classList.remove('hidden');
  } catch { addBotMessage('网络错误，请稍后重试'); }
  finally { saveResumeBtn.disabled = false; saveResumeBtn.textContent = '💾 保存到简历模块'; }
});

extractCancelBtn.addEventListener('click', () => {
  extractOverlay.classList.add('hidden');
});

extractConfirmBtn.addEventListener('click', () => {
  const checked = [...extractList.querySelectorAll('input[type=checkbox]:checked')];
  const toSave = checked.map(cb => extractedModules[parseInt(cb.dataset.index)]);
  let savedCount = 0;
  toSave.forEach(m => {
    try {
      // 动态导入 resume-store 的函数（已全局挂载）
      if (typeof addModule === 'function') {
        addModule(m.module_type, m.data);
        savedCount++;
      } else if (window.ResumeStore && typeof window.ResumeStore.addModule === 'function') {
        window.ResumeStore.addModule(m.module_type, m.data);
        savedCount++;
      }
    } catch (e) {
      console.warn('[AI] 保存模块失败:', e.message);
    }
  });
  extractOverlay.classList.add('hidden');
  addBotMessage(savedCount > 0 ? `已成功保存 ${savedCount} 个简历模块！去简历管理页面查看～` : '没有选择任何模块，保存已取消');
});
```

- [ ] **Step 4: 在对话完成后显示保存按钮**

在 `sendMessage` 函数末尾（SSE 流式读取完成之后），在 `spriteState = 'idle'` 前添加：

```javascript
// 显示"保存到简历"按钮（有对话内容后才显示）
if (messages.querySelectorAll('.pa-msg.user').length >= 1) {
  document.getElementById('paSaveResumeArea').classList.remove('hidden');
}
```

- [ ] **Step 5: 确认 addModule 全局可访问**

检查 `pages/home.html` 中 `resume-store.js` 的引入方式。如果是 ES module（`type="module"`），需要确保 `addModule` 等函数挂载到 `window.ResumeStore`：

在 `home.html` 引入 `resume-store.js` 的 `<script>` 标签中确认有类似：
```javascript
import { addModule, updateModule, getModules } from '/js/resume-store.js';
window.ResumeStore = { addModule, updateModule, getModules };
```

- [ ] **Step 6: 手动测试保存到简历**

1. 完成一段对话（告诉 AI 姓名、学历、经历等信息）
2. 输入框上方出现"保存到简历模块"按钮
3. 点击按钮，验证弹出预览界面
4. 勾选要保存的模块，点击"保存选中项"
5. 打开简历管理页面，验证模块已新增

预期：选中的模块写入 `yesjob_resume_modules`

- [ ] **Step 7: 提交前端简历保存功能**

```bash
git add js/pixel-assistant.js pages/home.html
git commit -m "feat(ai): add save-to-resume button with extraction preview"
```

---

## Task 7: 简历优化（推荐岗位入口）

**Files:**
- Modify: `js/pixel-assistant.js` (岗位卡片添加"优化简历"按钮)
- Modify: `backend/routers/ai.py` (`analyze-job-fit` 支持 resume_modules)
- Modify: `backend/schemas/ai.py` (扩展 AnalyzeJobFitRequest)

- [ ] **Step 1: 扩展 AnalyzeJobFitRequest schema**

修改 `backend/schemas/ai.py` 中的 `AnalyzeJobFitRequest`：

```python
class AnalyzeJobFitRequest(BaseModel):
    job_id: int
    resume_modules: list[dict[str, Any]] = []
```

- [ ] **Step 2: 在推荐卡片中添加"优化简历"按钮**

修改 `js/pixel-assistant.js` 中 `loadRecommendations()` 函数内的 jobList.innerHTML 模板：

```javascript
jobList.innerHTML = data.jobs.map((j, i) => `
  <div class="pa-job-card" data-id="${j.id}">
    <div class="pa-job-card-rank">${i + 1}</div>
    <div class="pa-job-card-body">
      <div class="pa-job-title">${escText(j.title || '')}</div>
      <div class="pa-job-company">${escText(j.company || '')}</div>
      <div class="pa-job-meta">
        <span>${escText(j.work_city || '')}</span>
        <span>${escText(j.recruit_type || '')}</span>
        <span>${escText(j.job_category || '')}</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
      <span class="pa-job-arrow">›</span>
      <button class="pa-optimize-btn" data-id="${j.id}" data-title="${escText(j.title || '')}" data-company="${escText(j.company || '')}" style="font-size:10px;padding:3px 6px;background:#9d3d00;color:white;border:none;border-radius:6px;cursor:pointer;">优化简历</button>
    </div>
  </div>
`).join('');
```

- [ ] **Step 3: 实现"优化简历"按钮点击逻辑**

在 `loadRecommendations()` 中，在岗位卡片点击事件绑定之后，添加优化按钮绑定：

```javascript
jobList.querySelectorAll('.pa-optimize-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation(); // 阻止冒泡到岗位卡片
    const jobId = btn.dataset.id;
    const jobTitle = btn.dataset.title;
    const jobCompany = btn.dataset.company;
    await startResumeOptimization(jobId, jobTitle, jobCompany);
  });
});
```

- [ ] **Step 4: 实现 `startResumeOptimization` 函数**

在 `initPixelAssistant()` 中添加：

```javascript
async function startResumeOptimization(jobId, jobTitle, jobCompany) {
  const token = localStorage.getItem('yesjob_token');
  if (!token) { addBotMessage('请先登录才能使用简历优化功能'); return; }
  
  addBotMessage(`正在分析「${jobTitle} - ${jobCompany}」与你的简历匹配情况...`);
  spriteState = 'thinking';
  
  let resumeModules = [];
  try {
    const raw = localStorage.getItem('yesjob_resume_modules');
    resumeModules = raw ? JSON.parse(raw).filter(m => !m.is_deleted) : [];
  } catch {}
  
  try {
    const resp = await fetch('/api/ai/analyze-job-fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ job_id: parseInt(jobId), resume_modules: resumeModules }),
    });
    if (!resp.ok) { addBotMessage('分析失败，请稍后再试'); spriteState = 'idle'; return; }
    
    const bubble = addBotMessage('');
    spriteState = 'talking';
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || t === 'data: [DONE]') continue;
        if (!t.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(t.slice(6));
          if (json.content) { bubble.innerHTML += escText(json.content); messages.scrollTop = messages.scrollHeight; }
        } catch {}
      }
    }
    spriteState = 'idle';
  } catch { addBotMessage('网络错误，请检查连接'); spriteState = 'idle'; }
}
```

- [ ] **Step 5: 手动测试简历优化**

1. 完成对话获取推荐岗位
2. 点击岗位卡片上的"优化简历"按钮
3. 验证 AI 开始流式输出匹配分析
4. 验证点击岗位卡片主体仍然打开岗位详情

预期：优化建议以流式文字显示，不跳转到岗位详情

- [ ] **Step 6: 提交简历优化功能**

```bash
git add js/pixel-assistant.js backend/schemas/ai.py backend/routers/ai.py
git commit -m "feat(ai): add JD-based resume optimization from recommend cards"
```

---

## Self-Review

### Spec Coverage Check

| Spec 要求 | 对应 Task |
|-----------|----------|
| 全屏聊天模式，CSS 类切换 | Task 1 ✅ |
| 弹窗/全屏共享 DOM，历史保持 | Task 1 Step 3 ✅ |
| 精灵拖拽，边界限制，刷新恢复 | Task 2 ✅ |
| 点击 vs 拖拽冲突处理（5px 阈值） | Task 2 Step 3 ✅ |
| 后端 context 注入 system prompt | Task 3 ✅ |
| 前端读取 localStorage 格式化简历 | Task 4 ✅ |
| 仅首条消息注入 context | Task 4 Step 2 ✅ |
| 后端 LLM 提取简历模块接口 | Task 5 ✅ |
| 前端"保存到简历"预览和确认 | Task 6 ✅ |
| 调用 resume-store.js addModule | Task 6 Step 3 ✅ |
| 推荐岗位卡片"优化简历"按钮 | Task 7 ✅ |
| 流式输出简历优化建议 | Task 7 Step 4 ✅ |

### 类型一致性

- `ExtractResumeRequest`：Task 5 Step 1 定义，Task 5 Step 3 使用 ✅
- `extract_resume_modules`：Task 5 Step 2 定义，Task 5 Step 3 import ✅
- `buildResumeContext()`：Task 4 Step 1 定义，Task 4 Step 2 调用 ✅
- `startResumeOptimization()`：Task 7 Step 4 定义，Task 7 Step 3 调用 ✅
- `MODULE_TYPE_LABELS`：Task 6 Step 3 定义，Task 6 Step 3 使用 ✅

```
```
