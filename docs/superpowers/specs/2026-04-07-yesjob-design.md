# YesJob 设计文档

**项目名称**: YesJob（逮JOB）  
**版本**: v1.0  
**日期**: 2026-04-07  
**状态**: 已批准，待实现

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [模块组件与数据流](#3-模块组件与数据流)
4. [数据库设计](#4-数据库设计)
5. [API 接口规范](#5-api-接口规范)
6. [AI 模块设计](#6-ai-模块设计)
7. [错误处理规范](#7-错误处理规范)
8. [测试策略](#8-测试策略)
9. [部署方案](#9-部署方案)

---

## 1. 项目概述

### 1.1 产品定位

YesJob 是一个面向校招/实习求职者的 AI 智能就业辅助平台，核心功能：

- **职位浏览**: 聚合哔哩哔哩校招/实习职位数据，提供搜索与多维筛选
- **AI 智能匹配**: 根据用户简历自动计算与职位的匹配分数
- **简历管理**: 上传解析简历，维护经历模块库，手动组合模块
- **AI 简历优化**: 针对特定职位，用 AI 重写简历内容，提升匹配度

### 1.2 核心约束

| 约束项 | 决策 |
|--------|------|
| 简历存储 | 仅存于浏览器 `localStorage`，不持久化到服务器 |
| 简历上传时机 | 仅调用 AI API 时临时发送，处理完立即丢弃 |
| 用户认证 | JWT 无状态认证，token 存于 `sessionStorage` |
| 数据来源 | 静态 JSONL 文件（`data/jobs.jsonl`），启动时导入 PostgreSQL |
| AI 策略 | 混合模式：Ollama 本地（轻量任务）+ DeepSeek/Qwen 远程 API（复杂任务）|

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (Browser)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  职位列表页   │  │  简历管理页  │  │   简历优化页     │  │
│  │  index.html  │  │  resume.html │  │  optimize.html   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         │    Tailwind CSS + Material Design 3  │            │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┴────────┐  │
│  │              localStorage (简历数据)                   │  │
│  │    sessionStorage (JWT token)                         │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/JSON (Fetch API)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   FastAPI (Python)                           │
│                                                             │
│   /auth/*          /jobs/*          /ai/*                   │
│   ┌────────┐   ┌────────────┐   ┌────────────────┐         │
│   │ 认证路由│   │ 职位路由   │   │   AI 路由      │         │
│   └────┬───┘   └─────┬──────┘   └───────┬────────┘         │
│        │             │                  │                   │
│   ┌────▼─────────────▼──────────────────▼────────────────┐ │
│   │              数据库层 (SQLAlchemy ORM)                 │ │
│   └────────────────────────┬──────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          │                  │                       │
┌─────────▼────────┐  ┌──────▼──────────┐  ┌───────▼──────────┐
│   PostgreSQL      │  │  Ollama (本地)  │  │  DeepSeek/Qwen   │
│                  │  │  llama3.2 3B    │  │  远程 API        │
│  - users 表      │  │  职位匹配评分   │  │  简历优化/重写   │
│  - jobs 表       │  └─────────────────┘  └──────────────────┘
└──────────────────┘
```

### 2.1 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | HTML5 + Tailwind CSS + Material Design 3 tokens |
| 图标 | Material Symbols |
| 字体 | Plus Jakarta Sans |
| 主色 | `#9d3d00`（暖橙/棕） |
| 后端 | Python 3.11+ / FastAPI |
| ORM | SQLAlchemy 2.x (async) |
| 数据库 | PostgreSQL 15+ |
| 认证 | JWT (python-jose) |
| AI 本地 | Ollama + llama3.2:3b |
| AI 远程 | DeepSeek API / Qwen API |
| 服务器 | Uvicorn + Nginx |

---

## 3. 模块组件与数据流

### 3.1 前端页面树

```
YesJob Frontend
├── index.html          职位列表（搜索 + 筛选 + 匹配分数）
├── login.html          登录 / 注册
├── resume.html         简历管理
│   ├── 上传区域（PDF/DOCX 解析）
│   ├── 模块库（教育/实习/项目/技能）
│   └── 模块组合区（拖拽或勾选）
└── optimize.html       AI 简历优化
    ├── 职位选择
    ├── 简历模块预览
    └── AI 优化结果展示（Markdown 渲染）
```

### 3.2 后端路由树

```
FastAPI App
├── /auth
│   ├── POST /auth/register      注册
│   └── POST /auth/login         登录，返回 JWT token
├── /jobs
│   ├── GET  /jobs               职位列表（分页 + 筛选）
│   ├── GET  /jobs/{job_id}      职位详情
│   └── GET  /jobs/meta/filters  返回可用筛选项（城市/类型/分类列表）
└── /ai
    ├── POST /ai/match           批量匹配评分（简历 ↔ 多职位）
    ├── POST /ai/optimize        简历优化（简历 + 单职位 → 重写内容）
    └── POST /ai/parse-resume    （可选）解析上传的简历文件
```

### 3.3 关键数据流

#### 职位浏览与筛选

```
用户输入筛选条件
    → GET /jobs?q=运营&city=上海&recruit_type=实习&page=1
    → FastAPI 构建 SQL 查询（含全文检索 GIN 索引）
    → 返回 {total, page, items: [...]}
    → 前端渲染职位卡片
```

#### AI 匹配评分

```
用户打开职位列表（已登录 + 有简历）
    → 前端从 localStorage 读取简历文本
    → POST /ai/match {resume_text, job_ids: [1,2,3,...]}
    → FastAPI 查询职位详情
    → Ollama (llama3.2) 批量评分（0-100）
    → 返回 {scores: {job_id: score, ...}}
    → 前端在职位卡片显示匹配徽章
    （若 Ollama 不可用 → score 返回 null → 前端隐藏匹配徽章）
```

#### AI 简历优化

```
用户选择职位 + 当前简历模块组合
    → 前端从 localStorage 读取简历文本
    → POST /ai/optimize {resume_text, job_id}
    → FastAPI 查询职位详情
    → DeepSeek/Qwen API 生成优化版简历（Markdown）
    → 流式返回（SSE 或分块传输）
    → 前端实时展示优化结果
    （用户可复制结果，但不自动保存）
```

---

## 4. 数据库设计

### 4.1 users 表

```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_login  TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
```

### 4.2 jobs 表

字段与 `data/jobs.jsonl` 完全对齐：

```sql
CREATE TABLE jobs (
    id              SERIAL PRIMARY KEY,

    -- 职位标识
    job_id          VARCHAR(50) UNIQUE NOT NULL,   -- 哔哩哔哩原始 job_id
    source_page     VARCHAR(20),                   -- 爬取来源页码

    -- 公司与职位基本信息
    company         VARCHAR(100) NOT NULL DEFAULT '哔哩哔哩',
    title           VARCHAR(200) NOT NULL,
    recruit_type    VARCHAR(50),                   -- 校招 / 实习
    job_category    VARCHAR(100),                  -- 产品运营类 / 技术类 等
    job_function    VARCHAR(100),                  -- 具体职能

    -- 工作地点
    work_city       VARCHAR(100),                  -- 主城市（字符串）
    work_cities     JSONB DEFAULT '[]',            -- 多城市数组

    -- 职位描述
    team_intro      TEXT DEFAULT '',
    responsibilities TEXT DEFAULT '',
    requirements    TEXT DEFAULT '',
    bonus_points    TEXT DEFAULT '',

    -- 标签
    tags            JSONB DEFAULT '[]',

    -- 时间与来源
    publish_time    TIMESTAMPTZ,
    detail_url      VARCHAR(500),
    fetched_at      TIMESTAMPTZ,

    -- 内部时间戳
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 全文检索索引（中文 simple 分词）
CREATE INDEX idx_jobs_title_fts
    ON jobs USING GIN (to_tsvector('simple', title));

-- 筛选字段 B-tree 索引
CREATE INDEX idx_jobs_work_city    ON jobs(work_city);
CREATE INDEX idx_jobs_recruit_type ON jobs(recruit_type);
CREATE INDEX idx_jobs_job_category ON jobs(job_category);
CREATE INDEX idx_jobs_publish_time ON jobs(publish_time DESC);
CREATE INDEX idx_jobs_company      ON jobs(company);

-- JSONB 索引（可选，按需添加）
CREATE INDEX idx_jobs_tags ON jobs USING GIN (tags);
```

### 4.3 数据导入

启动时检查 jobs 表是否为空，若为空则从 `data/jobs.jsonl` 批量导入：

```python
# backend/scripts/import_jobs.py
import jsonlines, asyncio
from sqlalchemy import text
from backend.database import async_session

async def import_jobs(filepath: str):
    async with async_session() as session:
        count = await session.execute(text("SELECT COUNT(*) FROM jobs"))
        if count.scalar() > 0:
            return  # 已有数据，跳过
        with jsonlines.open(filepath) as reader:
            jobs = [dict(row) for row in reader]
        # 批量插入，500 条一批
        for i in range(0, len(jobs), 500):
            batch = jobs[i:i+500]
            await session.execute(insert_jobs_stmt, batch)
        await session.commit()
```

---

## 5. API 接口规范

### 5.1 统一响应格式

成功：
```json
{
    "code": 200,
    "data": { ... },
    "message": "ok"
}
```

失败：
```json
{
    "code": 400,
    "error": "INVALID_PARAMS",
    "message": "city 参数不合法"
}
```

### 5.2 GET /jobs — 职位列表

**Query Parameters**:

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `q` | string | 关键词全文搜索（title） | `q=运营` |
| `city` | string | 城市筛选（work_city） | `city=上海` |
| `recruit_type` | string | 招聘类型 | `recruit_type=实习` |
| `job_category` | string | 职位类别 | `job_category=技术类` |
| `company` | string | 公司名称 | `company=哔哩哔哩` |
| `sort` | string | 排序方式 | `sort=latest`（默认）/ `sort=relevance` |
| `page` | int | 页码（从 1 开始） | `page=1` |
| `page_size` | int | 每页条数（默认 20，最大 100） | `page_size=20` |

**Response**:
```json
{
    "total": 1523,
    "page": 1,
    "page_size": 20,
    "items": [
        {
            "id": 1,
            "job_id": "16420",
            "title": "大模型运营实习生",
            "company": "哔哩哔哩",
            "recruit_type": "实习",
            "job_category": "产品运营类",
            "work_city": "上海",
            "work_cities": ["上海"],
            "tags": [],
            "publish_time": "2024-06-27T11:02:35+00:00",
            "detail_url": "https://jobs.bilibili.com/campus/positions/16420"
        }
    ]
}
```

### 5.3 GET /jobs/meta/filters — 可用筛选项

**Response**:
```json
{
    "cities": ["上海", "北京", "杭州", "..."],
    "recruit_types": ["校招", "实习"],
    "job_categories": ["技术类", "产品运营类", "设计类", "..."]
}
```

### 5.4 GET /jobs/{job_id} — 职位详情

**Response**: 完整职位对象（含 `responsibilities`, `requirements`, `bonus_points`, `team_intro`）

### 5.5 POST /auth/register

**Request Body**:
```json
{
    "username": "张三",
    "email": "zhangsan@example.com",
    "password": "SecurePass123"
}
```

**Response**:
```json
{
    "message": "注册成功",
    "user_id": 42
}
```

### 5.6 POST /auth/login

**Request Body**:
```json
{
    "email": "zhangsan@example.com",
    "password": "SecurePass123"
}
```

**Response**:
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 86400
}
```

### 5.7 POST /ai/match — 批量匹配评分

**Auth**: Bearer token required

**Request Body**:
```json
{
    "resume_text": "张三，计算机科学与技术，2024届...",
    "job_ids": [1, 2, 3, 4, 5]
}
```

**Response**:
```json
{
    "scores": {
        "1": 85,
        "2": 72,
        "3": null,
        "4": 91,
        "5": 68
    }
}
```

> `null` 表示该职位评分失败（Ollama 超时或返回格式错误）

**限制**:
- 单次最多 50 个 job_ids
- 超时 30 秒（Ollama 本地推理）

### 5.8 POST /ai/optimize — 简历优化

**Auth**: Bearer token required

**Request Body**:
```json
{
    "resume_text": "张三，计算机科学与技术...",
    "job_id": 1
}
```

**Response** (流式 SSE 或 JSON):
```json
{
    "optimized_resume": "# 张三\n\n## 教育背景\n...",
    "suggestions": [
        "强调了机器学习相关经验以匹配职位要求",
        "添加了量化指标以提升说服力"
    ]
}
```

---

## 6. AI 模块设计

### 6.1 匹配评分 (Ollama — llama3.2:3b)

**用途**: 轻量级本地推理，批量评估简历与职位的匹配程度

**Prompt 模板**:
```
你是一个招聘助手。请评估以下简历与职位的匹配程度，返回 0-100 的整数分数。

职位信息：
- 职位名称：{title}
- 职位类别：{job_category}
- 职责：{responsibilities}
- 要求：{requirements}

求职者简历：
{resume_text}

请只返回一个 0-100 的整数，不要有任何其他文字。
```

**批量处理逻辑**:
```python
async def batch_match(resume_text: str, jobs: list[Job]) -> dict[int, int | None]:
    scores = {}
    tasks = [score_single(resume_text, job) for job in jobs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for job, result in zip(jobs, results):
        if isinstance(result, Exception):
            scores[job.id] = None
        else:
            scores[job.id] = result
    return scores

async def score_single(resume_text: str, job: Job) -> int | None:
    prompt = build_match_prompt(resume_text, job)
    try:
        response = await ollama_client.generate(
            model="llama3.2:3b",
            prompt=prompt,
            timeout=10.0
        )
        return int(response.strip())
    except Exception:
        return None
```

**Fallback**: Ollama 服务不可用 → 所有 scores 返回 `null` → 前端隐藏匹配徽章

### 6.2 简历优化 (DeepSeek / Qwen 远程 API)

**用途**: 高质量简历重写，针对特定职位深度定制

**Prompt 模板**:
```
你是一位专业的简历优化顾问，擅长为中国互联网大厂校招/实习生优化简历。

目标职位：
- 公司：{company}
- 职位：{title}
- 职责要求：{responsibilities}
- 岗位要求：{requirements}
- 加分项：{bonus_points}

原始简历：
{resume_text}

请根据该职位的要求，对简历进行优化重写。要求：
1. 保留真实信息，不虚构经历
2. 用 STAR 法则重写项目/实习经历
3. 突出与该职位相关的技能和经验
4. 添加量化指标（如有可能）
5. 使用简洁专业的语言
6. 输出格式为 Markdown

请输出优化后的简历内容，并在最后附上 3-5 条优化说明。
```

**API 调用**:
```python
async def optimize_resume(resume_text: str, job: Job) -> dict:
    prompt = build_optimize_prompt(resume_text, job)
    
    # 优先尝试 DeepSeek
    try:
        response = await deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            timeout=60.0
        )
        return await stream_response(response)
    except Exception as e:
        # Fallback: 尝试 Qwen API
        try:
            return await qwen_optimize(prompt)
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="AI 服务暂时不可用，请稍后重试"
            )
```

### 6.3 AI 服务配置

```python
# backend/config.py
class Settings(BaseSettings):
    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_TIMEOUT: float = 10.0
    
    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    
    # Qwen (备用)
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-max"
    
    class Config:
        env_file = ".env"
```

---

## 7. 错误处理规范

### 7.1 HTTP 状态码

| 状态码 | 场景 |
|--------|------|
| 200 | 成功 |
| 400 | 参数错误（类型错误、缺少必填项、超出范围） |
| 401 | 未认证（缺少 token 或 token 无效） |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 422 | 数据验证失败（Pydantic 校验） |
| 429 | 请求频率超限（AI 接口） |
| 503 | AI 服务不可用 |
| 500 | 服务器内部错误 |

### 7.2 错误码定义

| error | 含义 |
|-------|------|
| `INVALID_PARAMS` | 请求参数不合法 |
| `AUTH_REQUIRED` | 需要登录 |
| `TOKEN_EXPIRED` | token 已过期 |
| `USER_NOT_FOUND` | 用户不存在 |
| `JOB_NOT_FOUND` | 职位不存在 |
| `AI_UNAVAILABLE` | AI 服务不可用 |
| `AI_TIMEOUT` | AI 推理超时 |
| `TOO_MANY_JOBS` | batch match 超过 50 个职位 |
| `RESUME_TOO_LONG` | 简历文本超过字数限制 |
| `INTERNAL_ERROR` | 服务器内部错误 |

### 7.3 前端错误行为

| 错误场景 | 前端行为 |
|----------|----------|
| 401 / token 过期 | 清除 sessionStorage token → 跳转 login.html |
| 网络断开 | Toast 提示"网络连接失败，请检查网络" |
| AI 服务 503 | Toast 提示"AI 服务暂时不可用，请稍后重试" |
| AI 超时 | Toast 提示"AI 响应超时" + 保留当前页面状态 |
| 匹配分数 null | 隐藏匹配徽章，不显示错误 |
| 职位列表加载失败 | 显示空状态插图 + "加载失败，点击重试" |

---

## 8. 测试策略

### 8.1 后端单元测试 (pytest)

```
tests/
├── conftest.py              测试数据库 fixture（SQLite in-memory）
├── test_auth.py             注册/登录/token 验证
├── test_jobs.py             职位列表/筛选/详情接口
├── test_ai_match.py         匹配评分（mock Ollama）
├── test_ai_optimize.py      简历优化（mock DeepSeek）
└── test_import.py           jobs.jsonl 导入逻辑
```

关键测试用例：

```python
# test_jobs.py
async def test_jobs_filter_by_city():
    resp = await client.get("/jobs?city=上海")
    assert resp.status_code == 200
    assert all(job["work_city"] == "上海" for job in resp.json()["items"])

async def test_jobs_fulltext_search():
    resp = await client.get("/jobs?q=大模型")
    assert resp.status_code == 200
    assert resp.json()["total"] > 0

async def test_jobs_pagination():
    resp = await client.get("/jobs?page=1&page_size=10")
    assert len(resp.json()["items"]) <= 10

# test_ai_match.py
async def test_match_returns_null_on_ollama_failure(mock_ollama_down):
    resp = await client.post("/ai/match", json={
        "resume_text": "测试简历",
        "job_ids": [1, 2, 3]
    })
    assert resp.status_code == 200
    assert all(v is None for v in resp.json()["scores"].values())
```

### 8.2 手动验收标准

| 功能 | 验收标准 |
|------|----------|
| 职位列表加载 | 首屏 < 1s，显示 20 条数据 |
| 关键词搜索 | 输入"运营"，结果标题均含"运营" |
| 城市筛选 | 选择"上海"，所有结果 work_city = "上海" |
| 用户注册 | 重复邮箱注册返回 400 + 明确错误提示 |
| 用户登录 | 正确凭据返回 token；错误凭据返回 401 |
| AI 匹配（Ollama 可用） | 职位卡片显示 0-100 分数徽章 |
| AI 匹配（Ollama 不可用） | 职位卡片不显示匹配徽章，无错误弹窗 |
| AI 简历优化 | 30s 内返回 Markdown 格式优化结果 |
| 简历本地存储 | 刷新页面后简历数据仍在 |
| token 过期 | 24h 后自动跳转登录页 |

---

## 9. 部署方案

### 9.1 腾讯云部署架构

```
用户
 │
 ▼
腾讯云 CDN
 │
 ├── 静态资源 → COS (对象存储)
 │   └── index.html, resume.html, optimize.html, *.css, *.js
 │
 └── /api/* → CVM (云服务器)
             └── Nginx（反向代理）
                  └── Uvicorn（FastAPI）
                       └── PostgreSQL（同机或 TDSQL-C Serverless）
```

### 9.2 初期部署方案（单台 CVM）

适合 MVP 阶段，成本最低：

```
CVM (2C4G，Ubuntu 22.04)
├── Nginx               80/443 端口，反向代理到 uvicorn
├── Uvicorn             127.0.0.1:8000，运行 FastAPI
├── PostgreSQL 15       127.0.0.1:5432
├── Ollama              127.0.0.1:11434（可选，需要 GPU 或性能足够的 CPU）
└── Let's Encrypt SSL   自动续签 HTTPS
```

**Nginx 配置要点**:
```nginx
server {
    listen 443 ssl;
    server_name yesjob.example.com;

    # 前端静态文件（或反向代理到 COS）
    location / {
        root /var/www/yesjob;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;  # AI 接口超时时间
    }
}
```

### 9.3 生产部署方案（弹性扩展）

```
CDN → COS (前端静态)
CDN → CVM 集群 (FastAPI，负载均衡)
          └── TDSQL-C Serverless（按量计费 PostgreSQL）
```

### 9.4 环境变量

```bash
# .env (生产环境)
DATABASE_URL=postgresql+asyncpg://user:password@localhost/yesjob
SECRET_KEY=<random-32-char-string>
JWT_EXPIRE_HOURS=24

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

DEEPSEEK_API_KEY=sk-xxxxxxxx
QWEN_API_KEY=sk-xxxxxxxx

CORS_ORIGINS=["https://yesjob.example.com"]
```

### 9.5 启动脚本

```bash
#!/bin/bash
# start.sh

# 1. 数据库迁移
alembic upgrade head

# 2. 导入职位数据（首次运行）
python -m backend.scripts.import_jobs data/jobs.jsonl

# 3. 启动服务
uvicorn backend.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info
```

---

## 附录：项目目录结构

```
YesJob/
├── data/
│   └── jobs.jsonl              原始职位数据
├── frontend/
│   ├── index.html              职位列表页
│   ├── login.html              登录/注册页
│   ├── resume.html             简历管理页
│   └── optimize.html           简历优化页
├── backend/
│   ├── main.py                 FastAPI 入口
│   ├── config.py               配置（Settings）
│   ├── database.py             数据库连接（async SQLAlchemy）
│   ├── models/
│   │   ├── user.py             User ORM 模型
│   │   └── job.py              Job ORM 模型
│   ├── schemas/
│   │   ├── auth.py             Pydantic 认证 schema
│   │   ├── job.py              Pydantic 职位 schema
│   │   └── ai.py               Pydantic AI 请求/响应 schema
│   ├── routers/
│   │   ├── auth.py             /auth 路由
│   │   ├── jobs.py             /jobs 路由
│   │   └── ai.py               /ai 路由
│   ├── services/
│   │   ├── auth_service.py     认证业务逻辑
│   │   ├── job_service.py      职位查询/筛选逻辑
│   │   ├── ollama_service.py   Ollama 调用封装
│   │   └── llm_service.py      DeepSeek/Qwen 调用封装
│   └── scripts/
│       └── import_jobs.py      数据导入脚本
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_jobs.py
│   ├── test_ai_match.py
│   └── test_ai_optimize.py
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-07-yesjob-design.md   本文档
├── alembic/                    数据库迁移
├── .env                        环境变量（不提交 git）
├── .env.example                环境变量模板
├── requirements.txt            Python 依赖
├── start.sh                    启动脚本
└── nginx.conf                  Nginx 配置参考
```

---

*文档结束。所有四个设计板块（架构、数据库/API、AI 模块、错误处理与测试）均已包含，可直接用于指导实现。*
