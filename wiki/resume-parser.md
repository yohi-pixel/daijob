# 简历解析器（规则式，无 LLM）

核心文件：`backend/services/resume_parse_service.py` + `backend/schemas/resume_parse.py`。
端点：`POST /api/resume/parse`（multipart：file + has_basic_info）。

## 1. 流水线

```
文件上传 → extract_text()          # PDF: pdfplumber / DOCX: python-docx
        → parse_text()            # 规则解析（无模型依赖）
        → ParsedResume            # basic_info + experiences + skill + summary
```

- 支持格式：`.pdf`、`.docx`，其他 400
- `has_basic_info=true` → 丢弃 basic_info（前端已收集）

## 2. 解析结构

```
ParsedResume
├── basic_info: {name, target_role, phone, email, age, location}
├── experiences: [ExperienceModule]
│     ├── module_type: education | experience | award
│     └── data:
│         ├─ education:  {start_date, end_date, gpa, school, major, description}
│         ├─ experience: {org, role, start_date, end_date, description}
│         └─ award:      {name, date, description}
├── skill:  {items: [...]}
└── summary: {content}
```

## 3. 规则设计

### 章节识别（SECTION_PATTERNS，行首正则）
| 章节 | 匹配 |
|---|---|
| education | 教育背景/教育经历/学历 |
| experience | 实习.*经历/工作.*经历/项目.*经历/实习及项目/经历 |
| award | 奖项/荣誉/获奖/竞赛/比赛 |
| skill | 技能/专业技能/技术栈/掌握 |
| summary | 自我描述/个人简介/自我评价/关于我 |

### 经历条目头（ENTRY_RE）
`名称|职位 时间` 或 `名称|职位\t时间`，如 `钛动科技|广告优化实习生 2026.1-2026.4`
- 日期区间按 `-至~到` 拆分 start/end

### 教育行（EDU_RE）
`2023.9 至今 GPA:x/y (排名) 学校/专业`

### 基本信息（前 6 行扫描）
- 姓名：首个短行（≤10 字、无冒号）
- 正则抓取：`手机/电话: xxx`、`邮箱: xxx`、`年龄: n`、`地址/城市: xxx`、`求职意向: xxx`

### 技能
按 `、，,；;/／\s` 拆分累加

### 摘要
章节头后直到下一章节头，整段收集

### 子弹行清洗
`_collect_bullets` 收集条目头后的说明行，去掉 `•·-*･◦` 前缀，遇新章节/新条目头停止

## 4. 边界与缺陷

- 依赖**中文简历排版规范**（章节标题 + `|` 分隔条目），西式/无格式简历解析率低
- 教育行必须匹配固定正则，GPA 可选
- 姓名识别启发式（短行无冒号），可能误判
- 无 LLM 兜底——这是**规则式**设计，优势是零成本零延迟，劣势是泛化性有限
- 未来可接 `OLLAMA_PARSE_MODEL`（qwen2.5:0.5b 已预留配置）做 LLM 兜底

## 5. 测试

`backend/tests/` 覆盖解析（`test_clean_jobs.py` 相关 + 解析逻辑），pytest 运行于内存 SQLite。
