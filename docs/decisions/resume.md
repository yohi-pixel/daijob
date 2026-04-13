# 简历管理模块 — 需求与数据结构设计

> 状态：**已定稿**（2026-04-10）

---

## 1. 核心理念

**模块化简历管理**：不存储用户的整份简历文件，而是将简历拆解为独立模块分别存储。用户可以自由组合模块生成一份完整简历，并针对不同岗位做个性化调整。

**存储方案**：所有数据存储在用户浏览器的 `localStorage`，无需后端数据库。

---

## 2. 数据流向

```
用户输入（PDF / Word / 粘贴文本）
        ↓
    解析引擎（规则 + 大模型 API）
        ↓
    拆分为独立模块（结构化 JSON）
        ↓
    存入 localStorage（按模块类型组织）
        ↓
    用户管理 / 打标签 / 复制模块 / 组装简历
        ↓
    AI 优化（模块级 / 整份简历 / 针对 JD）→ 预览 → 用户确认保存/新建
        ↓
    导出 PDF
        ↓
    岗位匹配评分 & 个性化推荐（接口预留，后续实现）
```

---

## 3. localStorage 存储结构

所有数据存在以下 key 下：

```
yesjob_resume_modules     → 所有模块列表（数组）
yesjob_resume_snapshots   → 所有简历快照列表（数组）
yesjob_resume_settings    → 用户设置（AI 模型配置等）
```

模块列表示例：
```json
[
  { "id": "mod_001", "module_type": "work_experience", "tags": ["数据分析"], ... },
  { "id": "mod_002", "module_type": "skill", "tags": ["数据分析", "后端"], ... }
]
```

> **ID 生成**：客户端生成，格式 `mod_` + timestamp + random，保证唯一性。

---

## 4. 模块类型与数据结构

### 公共字段（所有模块共有）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 客户端生成唯一 ID，如 `mod_1712345678_abc` |
| `module_type` | enum | 模块类型 |
| `tags` | list[str] | 求职方向标签，模块填写时自由打，如 `["数据分析"]` |
| `is_deleted` | bool | 软删除标记 |
| `created_at` | ISO string | 创建时间 |
| `updated_at` | ISO string | 最后修改时间 |
| `source` | enum | `manual` / `parsed` / `ai_generated` |
| `cloned_from` | string \| null | 若由复制创建，记录原模块 ID（仅作溯源，无引用关系） |

### 4.1 基本信息 `basic_info`

```json
{
  "name": "张三",
  "phone": "138xxxx0000",
  "email": "zhangsan@example.com",
  "location": "北京",
  "linkedin": "",
  "github": "",
  "website": "",
  "birth_year": 2000,
  "gender": "male"
}
```

> `birth_year` / `gender` 为可选字段，不填时省略。

### 4.2 照片 `photo`

```json
{
  "data_url": "data:image/jpeg;base64,...",
  "filename": "avatar.jpg"
}
```

> 照片以 base64 Data URL 存入 localStorage。注意大图会占用较多空间，建议前端压缩至 200KB 以内再存储。

### 4.3 教育经历 `education`

```json
{
  "school": "北京大学",
  "degree": "本科",
  "major": "计算机科学",
  "start_date": "2020-09",
  "end_date": "2024-06",
  "gpa": "3.8/4.0",
  "description": "主修课程：数据结构、机器学习..."
}
```

### 4.4 工作/实习经历 `work_experience`

```json
{
  "company": "字节跳动",
  "position": "数据分析实习生",
  "employment_type": "internship",
  "start_date": "2023-07",
  "end_date": "2023-10",
  "is_current": false,
  "location": "北京",
  "description": "负责用户行为数据分析，搭建 A/B 测试框架...",
  "highlights": [
    "使用 SQL + Python 处理日均 1 亿条日志",
    "A/B 测试使核心指标提升 12%"
  ]
}
```

> `employment_type`: `full_time` / `internship` / `part_time` / `freelance`

### 4.5 项目经历 `project`

```json
{
  "name": "逮JOB AI招聘平台",
  "role": "全栈开发",
  "start_date": "2024-01",
  "end_date": "2024-06",
  "is_current": false,
  "url": "https://github.com/xxx/yesjob",
  "tech_stack": ["FastAPI", "Vue3", "MySQL"],
  "description": "基于大模型的智能招聘平台...",
  "highlights": [
    "实现简历模块化管理与 AI 优化",
    "岗位匹配准确率达 85%"
  ]
}
```

### 4.6 科研经历 `research`

```json
{
  "institution": "北京大学计算机系",
  "supervisor": "李教授",
  "topic": "基于 LLM 的简历解析研究",
  "start_date": "2023-09",
  "end_date": "2024-06",
  "is_current": false,
  "publications": ["论文标题, 会议名, 2024"],
  "description": "研究内容描述..."
}
```

### 4.7 技能 `skill`

包含编程语言、工具、语言能力等所有技能类型。

```json
{
  "category": "编程语言",
  "items": ["Python", "SQL", "JavaScript"],
  "proficiency": "proficient"
}
```

> `proficiency`: `familiar` / `proficient` / `expert`
> `category` 示例：`编程语言`、`工具与框架`、`语言能力`、`数据分析工具`

### 4.8 奖项荣誉 `award`

```json
{
  "title": "国家奖学金",
  "issuer": "教育部",
  "date": "2023-10",
  "description": ""
}
```

### 4.9 自我描述 `summary`

允许多条，每条对应不同求职方向，通过 `tags` 区分。

```json
{
  "content": "具有 2 年数据分析经验，熟悉 A/B 测试与用户行为分析，寻求数据方向全职机会。"
}
```

### 4.10 证书/资质 `certificate`

```json
{
  "name": "CFA Level 1",
  "issuer": "CFA Institute",
  "date": "2023-06",
  "url": ""
}
```

---

## 5. 标签系统（Tags）

- 每个模块填写时自由打标签，无全局标签库
- 系统在输入时提示用户已用过的标签（从现有模块中聚合）
- 用途：筛选模块、快速组装简历草稿、匹配评分方向

---

## 6. 模块复制（深拷贝）

用户可以从已有模块复制出一个新模块进行修改，**必须深拷贝，不得保留任何引用**。

```js
function cloneModule(original) {
  const cloned = JSON.parse(JSON.stringify(original)); // 深拷贝
  cloned.id = generateId();                            // 新 ID
  cloned.cloned_from = original.id;                   // 溯源记录
  cloned.source = 'manual';
  cloned.created_at = new Date().toISOString();
  cloned.updated_at = new Date().toISOString();
  return cloned;
}
```

> **关键原则**：简历快照（Snapshot）中存储的是模块内容的**深拷贝**，而非模块 ID 引用。这样修改原模块不会影响已组装的简历，修改简历中的模块也不会影响模块库。

---

## 7. 简历快照（Resume Snapshot）

快照存储的是**模块内容的完整副本**，而非 ID 引用，保证快照的独立性和不变性。

```json
{
  "id": "snap_1712345678_xyz",
  "name": "数据分析方向简历 v2",
  "target_tags": ["数据分析"],
  "created_at": "2026-04-10T12:00:00Z",
  "updated_at": "2026-04-10T12:00:00Z",
  "sections": [
    {
      "module_type": "basic_info",
      "order": 0,
      "content": { "name": "张三", "phone": "...", ... }
    },
    {
      "module_type": "work_experience",
      "order": 1,
      "content": { "company": "字节跳动", ... }
    }
  ]
}
```

> **快照内编辑**：用户在快照内修改某个 section 的内容，只影响该快照，不影响模块库中的原始模块。

---

## 8. AI 优化

### 8.1 优化粒度

| 粒度 | 说明 |
|------|------|
| 模块级 | 优化单个模块的描述文字 |
| 简历级 | 对整份快照做整体润色 |
| JD 针对性 | 用户从已收藏岗位中选定一个，AI 根据 JD 重写相关模块 |

### 8.2 模型支持

- 本地模型（Ollama / LM Studio，OpenAI 兼容接口）
- 云端 API（OpenAI / Claude / DeepSeek 等）
- 用户在设置中配置 endpoint、API Key、模型名称

### 8.3 优化流程

```
用户触发优化（选模块 or 整份简历）+ 可选：选定目标岗位
        ↓
构建 Prompt（内容 + JD + 优化指令）
        ↓
流式调用模型 API
        ↓
展示 diff 预览（原文 vs 优化后，支持手动修改）
        ↓
用户选择：
  ├─ 覆盖保存（替换当前内容）
  └─ 另存为新模块/新快照
```

---

## 9. PDF 导出

- 方案：客户端渲染，`html2pdf.js` 或 `jsPDF` + `html2canvas`
- 流程：用户选择模板 → 渲染为 HTML → 转 PDF → 下载
- 模板：支持多套，用户导出时选择
- 照片处理：**不在模块库中存储照片**。仅在用户触发导出时，弹出上传照片的选项，照片只用于本次渲染，不持久化存储

### 模板列表（待设计）

| 模板 ID | 风格描述 | 状态 |
|---------|---------|------|
| `classic` | 传统单栏，黑白正式 | 待设计 |
| `modern` | 双栏，带色块 | 待设计 |
| `minimal` | 极简线条 | 待设计 |

---

## 10. 简历解析（PDF/Word → 模块）

**方案：前端解析 + AI 结构化**

```
用户上传文件（PDF / Word）或粘贴文本
        ↓
前端提取纯文本
  ├─ PDF：使用 pdf.js 提取文本层
  └─ Word（.docx）：使用 mammoth.js 提取文本
        ↓
将文本发送给 AI（用户配置的模型）
  Prompt：将以下简历文本解析为指定 JSON 结构...
        ↓
AI 返回结构化 JSON → 前端校验 → 写入模块库
```

**前端解析的局限性（已知）**：
- 扫描版 PDF（图片型）无法提取文字，需提示用户粘贴文本
- 复杂排版的 Word 文件提取文本可能乱序
- AI 解析依赖用户自己配置的模型，无模型配置时不可用

> 如后续出现性能/延迟/并发问题，再考虑迁移到后端 API。

---

## 11. 存储配额管理

localStorage 上限约 5MB，通过**硬性配额**控制存储量：

| 模块类型 | 最大数量 | 说明 |
|---------|---------|------|
| `basic_info` | 1 | 只保留一份基本信息 |
| `work_experience` / `project` / `research` / `education` / `award` / `certificate` | 合计 10 | 所有"经历类"模块统一共享上限，不分类型单独限制 |
| `summary` | 5 | 多方向自我描述 |
| `skill` | 1 | 技能模块（含多个 category） |
| 简历快照 | 2 | 最多保存 2 份组装好的简历 |
| 照片 | 0 | 不持久化，仅导出时临时使用 |

**配额提示规则**：
- 新增模块前检查对应类型数量，达到上限时弹出提示："已达上限，请删除旧模块后再添加"
- 新增快照前检查快照数量，达到上限时提示用户删除或覆盖
- 页面加载时检测 localStorage 已用空间，超过 4MB 时显示警告横幅

```js
// 配额常量
const QUOTA = {
  basic_info: 1,
  experience: 10,   // work_experience + project + research + education + award + certificate
  summary: 5,
  skill: 1,
  snapshots: 2,
};

const EXPERIENCE_TYPES = ['work_experience', 'project', 'research', 'education', 'award', 'certificate'];
```

---

## 12. 岗位匹配评分 & 推荐（接口预留）

匹配和推荐算法后续单独开发，当前只定义接口规范：

```js
// 输入
{
  resume_modules: [...],   // 用户当前模块库（或指定快照）
  target_tags: [...],      // 筛选方向（可选）
  job_list: [...]          // 待匹配岗位列表
}

// 输出
{
  scores: {
    "job_id_123": 85,
    "job_id_456": 72,
    ...
  },
  recommended: ["job_id_123", ...]
}
```

---

## 13. PDF 模板方案

三套模板，均为 A4 竖版，客户端 HTML 渲染后转 PDF。

### Classic — 传统正式

```
┌─────────────────────────────────┐
│  张三                           │
│  数据分析师 · 北京              │
│  138xxxx · email@example.com    │
├─────────────────────────────────┤
│ 工作经历                        │
│  ─────────────────────────────  │
│  字节跳动 · 数据分析实习生      │
│  2023.07 — 2023.10              │
│  · 使用 SQL + Python 处理...    │
│                                 │
│ 技能                            │
│  ─────────────────────────────  │
│  Python · SQL · Tableau         │
└─────────────────────────────────┘
```

- 单栏布局，全黑白
- 字体：衬线体（Noto Serif SC）
- 分隔线区分各模块，无色块
- 适合：金融、法律、传统行业

---

### Modern — 现代双栏

```
┌──────────┬──────────────────────┐
│ ░░░░░░░░ │ 工作经历             │
│  张三    │  字节跳动            │
│  数据分析│  2023.07—2023.10     │
│          │  · 处理日均1亿条...  │
│ 技能     ├──────────────────────┤
│  Python  │ 项目经历             │
│  SQL     │  逮JOB               │
│  Tableau │  2024.01—2024.06     │
│          │  · 全栈开发...       │
│ 教育     │                      │
│  北京大学│                      │
└──────────┴──────────────────────┘
```

- 左栏（30%）：基本信息、技能、教育，深色背景（主题色）
- 右栏（70%）：工作/项目/科研经历、自我描述
- 字体：无衬线体（Plus Jakarta Sans）
- 适合：互联网、设计、产品

---

### Minimal — 极简线条

```
┌─────────────────────────────────┐
│                                 │
│  张三                           │
│  ________________________________│
│                                 │
│  EXPERIENCE                     │
│                                 │
│  字节跳动                 2023  │
│  数据分析实习生                 │
│  使用 SQL + Python 处理...      │
│                                 │
│  SKILLS                         │
│                                 │
│  Python   SQL   Tableau         │
│                                 │
└─────────────────────────────────┘
```

- 单栏，大量留白
- 仅用细线和字号区分层级，无色块无边框
- 字体：等宽感无衬线（Inter）
- 模块标题全大写英文
- 适合：技术岗、研究岗、海外投递

---

## 14. 待确认问题

无。文档已定稿，可进入实现阶段。
