# AI 聊天增强功能设计文档

**日期**：2026-04-22  
**功能范围**：全屏聊天模式、简历数据集成、像素精灵拖拽

---

## 1. 概述

为 YesJob AI 助手增加三项功能：

1. **全屏聊天模式**：支持弹窗和全屏两种视图，共享聊天历史
2. **简历数据集成**：AI 自动读取已有简历、提问缺失信息、保存提取的数据到简历模块、支持基于 JD 的简历优化
3. **像素精灵拖拽**：精灵本体可拖拽移动（临时位置，不持久化）

---

## 2. 架构概览

**技术栈**：
- 后端：FastAPI + SQLAlchemy 2.0 + AsyncOpenAI (DeepSeek)
- 前端：Vanilla JS + Canvas API
- 存储：SQLite (user_profiles.profile_json) + localStorage (resume modules)

**核心设计原则**：
- 单一组件管理多视图：`pixel-assistant.js` 同时控制弹窗和全屏模式
- 状态共享：聊天历史、输入框内容在两种视图间无缝切换
- 渐进增强：简历数据缺失时降级为正常对话，不阻塞功能

---

## 3. 功能 1：全屏聊天模式

### 3.1 UI 结构

**现有弹窗**（保持不变）：
- 固定在右下角，340px 宽，最大高度 520px
- 包含：头部、消息列表、推荐岗位区、输入框

**新增全屏模式**：
- 覆盖整个视口（`position: fixed; inset: 0`）
- 布局：左侧消息列表（60%宽），右侧推荐岗位固定栏（40%宽）
- 头部新增"退出全屏"按钮（替换关闭按钮）

### 3.2 切换机制

**触发方式**：
- 弹窗头部新增"展开"图标按钮（⛶）
- 全屏模式头部显示"退出全屏"按钮（✕）

**实现方式**：
- CSS 类切换：`#paWindow.fullscreen` 应用全屏样式
- JavaScript 状态变量：`let isFullscreen = false`
- 切换时保持 DOM 结构不变，仅修改 CSS 类

**状态保持**：
- 消息列表、输入框内容、推荐岗位数据在切换时完全保留
- 滚动位置自动调整到最新消息

---

## 4. 功能 2：共享聊天历史

### 4.1 数据流

**存储层级**：
1. **内存状态**（`pixel-assistant.js` 内部变量）：当前会话的消息数组
2. **后端持久化**（`user_profiles.profile_json.conversation_history`）：每次发送消息后自动保存
3. **localStorage 缓存**（可选，暂不实现）：离线查看历史

**同步时机**：
- 用户发送消息 → 前端立即追加到内存 → 后端 SSE 响应完成后保存到 DB
- 打开对话窗口 → 从后端 `GET /api/ai/profile` 加载历史 → 渲染到消息列表

### 4.2 视图共享

**实现方式**：
- 弹窗和全屏共用同一个 `#paMessages` DOM 元素
- 切换视图时不重新渲染消息列表，仅调整 CSS 布局
- 输入框 `#paInput` 的 value 在切换时保持不变

---

## 5. 功能 3：像素精灵拖拽

### 5.1 拖拽目标

**拖拽对象**：Canvas 精灵本体（`#paSprite`），而非对话窗口

**现有实现**：
- 对话窗口头部已支持拖拽（lines 414-430）
- 精灵本体当前仅支持点击打开对话

### 5.2 实现方案

**事件绑定**：
- `#paSprite` 添加 `mousedown` 监听器
- 拖拽时修改精灵的 `position: fixed` 坐标（`left`, `bottom`）
- 拖拽结束后位置不持久化，刷新页面恢复默认位置

**边界限制**：
- 拖拽时限制在视口内：`Math.max(0, Math.min(x, window.innerWidth - spriteWidth))`
- 垂直方向同理：`Math.max(0, Math.min(y, window.innerHeight - spriteHeight))`

**与点击事件的冲突处理**：
- 记录 `mousedown` 和 `mouseup` 的坐标
- 如果移动距离 < 5px，视为点击（打开对话）
- 否则视为拖拽（不触发点击）

---

## 6. 功能 4：AI 读取简历 + 保存回简历模块

### 6.1 读取已有简历数据

**触发时机**：对话开始时（首次打开对话窗口）

**数据来源**：`localStorage.getItem('yesjob_resume_modules')`

**数据格式化**：
```javascript
// 从 resume-store.js 读取所有模块
const modules = getModules();
const resumeSummary = modules.map(m => {
  if (m.module_type === 'basic_info') return `姓名：${m.data.name}，学历：${m.data.education}`;
  if (m.module_type === 'experience') return `经历：${m.data.company} - ${m.data.role}`;
  // ... 其他类型
}).join('\n');
```

**注入方式**：
- 前端在 `POST /api/ai/chat` 请求体中新增 `context` 字段
- 后端在构建 system prompt 时追加："用户已有简历信息：\n{context}\n\n请根据已有信息提问缺失部分。"

### 6.2 保存提取的简历数据

**触发时机**：对话结束后，用户点击"保存到简历"按钮

**提取流程**：
1. 前端调用 `POST /api/ai/extract-resume`，请求体：`{ conversation_history: [...] }`
2. 后端调用 LLM 提取结构化数据（类似现有的 `extract_profile_from_history`）
3. 返回格式：`{ modules: [{ module_type, data }, ...] }`

**保存流程**：
1. 前端展示预览界面：左侧原始模块，右侧提取的新模块
2. 用户勾选要保存的模块
3. 调用 `resume-store.js` 的 `addModule()` 或 `updateModule()` 写入 localStorage

**后端新增接口**：
```python
@router.post("/extract-resume")
async def extract_resume_endpoint(
    body: ExtractResumeRequest,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 调用 LLM 提取结构化数据
    # 返回 { modules: [...] }
```

---

## 7. 功能 5：简历优化（AI 改写 + 快照生成）

### 7.1 触发场景

用户在推荐岗位卡片上点击"优化简历"按钮

### 7.2 流程

**1. 获取 JD 详情**：
- 前端调用 `GET /api/jobs/{job_id}` 获取完整 JD
- 展示确认弹窗："要针对【前端开发工程师 - 字节跳动】优化简历吗？"

**2. AI 分析 + 改写建议**：
- 调用 `POST /api/ai/analyze-job-fit`（已有接口）
- 请求体：`{ job_id: 123, resume_modules: [...] }`（从 localStorage 读取）
- 后端返回：`{ fit_score: 85, suggestions: [...], rewritten_modules: [...] }`

**3. 预览改写结果**：
- 展示对比视图：左侧原始模块，右侧 AI 改写版本
- 每个模块可单独勾选"应用此改写"
- 底部按钮："应用选中的改写" / "生成新快照"

**4. 应用改写**：
- "应用选中的改写"：直接覆盖 localStorage 中的对应模块
- "生成新快照"：调用 `resume-pdf.js` 的 `createSnapshot()`，快照名称自动添加岗位标签（如"字节跳动-前端开发"）

### 7.3 后端改动

**修改 `POST /api/ai/analyze-job-fit`**：
- 请求体新增 `resume_modules` 字段
- 返回体新增 `rewritten_modules` 字段：`[{ module_id, module_type, data: {...} }]`

---

## 8. 错误处理

### 8.1 全屏模式切换
- 无需特殊错误处理，纯 CSS 状态切换

### 8.2 聊天历史同步
- localStorage 读取失败：降级为空历史，不阻塞对话
- 后端 profile_json 解析失败：返回空数组，前端显示"暂无历史记录"

### 8.3 简历数据注入
- localStorage 读取失败：context 字段为空字符串，AI 正常提问收集信息
- 后端 LLM 调用超时（30s）：返回 504，前端提示"简历分析超时，请稍后重试"

### 8.4 简历保存
- LLM 提取失败：返回 422 + 错误信息，前端显示"提取失败，请检查对话内容"
- localStorage 写入失败（配额超限）：前端提示"存储空间不足，请删除旧快照"

### 8.5 简历优化
- JD 获取失败（岗位已下架）：提示"岗位信息已失效"
- LLM 改写超时：返回 504，前端提示"优化超时，请重试"
- 快照生成失败：捕获 PDF 生成错误，提示"快照生成失败"

### 8.6 像素精灵拖拽
- 拖拽超出视口：自动限制在可视区域内（`Math.max(0, Math.min(x, window.innerWidth - width))`）

### 8.7 通用策略
- 所有 API 调用添加 15s 超时（fetch AbortController）
- SSE 断连自动重试 3 次，间隔 2s
- 前端显示具体错误信息，避免"未知错误"

---

## 9. 测试策略

### 9.1 后端测试
- `POST /api/ai/extract-resume`：用固定对话历史测试 LLM 提取结果格式是否正确
- `POST /api/ai/analyze-job-fit`：验证 `rewritten_modules` 字段存在且格式匹配 resume-store 结构
- 邀请码验证：测试正确/错误码的响应状态码

### 9.2 前端手动验证路径
1. **全屏切换**：点击展开按钮 → 验证 CSS 类切换，弹窗/全屏状态互斥
2. **历史共享**：弹窗发消息 → 切换全屏 → 验证消息列表一致
3. **简历注入**：localStorage 写入测试模块 → 打开对话 → 检查 Network 请求 body 包含 `context` 字段
4. **简历保存**：完成对话 → 点击"保存到简历" → 验证 localStorage 中 `yesjob_resume_modules` 新增条目
5. **拖拽**：拖拽精灵到边缘 → 验证不超出视口

### 9.3 不测试
- LLM 输出质量（非确定性）
- PDF/Word 导出（已有功能，不在本次范围）

---

## 10. 实现文件清单

### 10.1 后端修改
- `backend/services/chat_service.py`：修改 `chat_stream()` 支持 context 注入
- `backend/routers/ai.py`：新增 `POST /api/ai/extract-resume`，修改 `POST /api/ai/analyze-job-fit`
- `backend/schemas/ai.py`：新增 `ExtractResumeRequest`、`ExtractResumeResponse`

### 10.2 前端修改
- `js/pixel-assistant.js`：
  - 新增全屏模式 CSS 和切换逻辑
  - 新增精灵拖拽事件监听
  - 修改 `sendMessage()` 注入 context 字段
  - 新增 `showResumeOptimization()` 函数
  - 新增"保存到简历"按钮和预览界面
- `js/resume-store.js`：无需修改（复用现有 API）

---

## 11. 实现优先级

1. **P0（核心功能）**：全屏模式、精灵拖拽、简历数据注入
2. **P1（增强功能）**：简历保存、简历优化
3. **P2（优化体验）**：错误重试、超时处理
