# 系统架构

## 1. 总体结构

```
┌─────────────────────────────────────────────────────┐
│  前端 (React 18 + TS + Tailwind)                    │
│  frontend/  Vite dev server (:5173) 或 Nginx 托管    │
└──────────────────────┬──────────────────────────────┘
                       │ /api/* → localhost:8000 (Vite proxy / Nginx 反代)
┌──────────────────────▼──────────────────────────────┐
│  FastAPI 后端 (backend/)                            │
│  main.py → routers/ → services/ → models/           │
└──────────┬─────────────────────────┬────────────────┘
           │                         │
┌──────────▼──────────┐   ┌──────────▼─────────────────┐
│ MySQL 8.0 (生产)     │   │ 外部 AI 服务                │
│ SQLite (开发/测试)   │   │ DeepSeek / Qwen API        │
│ 3 张表               │   │ Ollama (localhost:11434)   │
└─────────────────────┘   │ BGE-small-zh-v1.5 (向量)   │
                          └────────────────────────────┘
```

## 2. 分层职责

| 层 | 目录 | 职责 | 关键约束 |
|---|---|---|---|
| HTTP 层 | `backend/routers/` | 参数校验、依赖注入、路由 | 只做编排，不含业务逻辑 |
| 业务层 | `backend/services/` | 全部业务逻辑与 AI 调用 | 被 router 调用 |
| ORM 层 | `backend/models/` | SQLAlchemy 2.0 映射 | `Base(DeclarativeBase)` |
| Schema 层 | `backend/schemas/` | Pydantic 请求/响应模型 | 含 datetime 清洗 validator |
| 数据层 | `backend/scripts/` | JSONL 导入/清洗 | 幂等，去重键 `(company, job_id)` |

## 3. 启动流程（lifespan）

```
app 启动
 ├─ Base.metadata.create_all()       # 建表（MySQL/SQLite 均支持）
 └─ import_jobs_if_empty()          # jobs 表为空时导入 data/jobs.jsonl
```

## 4. 请求链路示例

### 岗位搜索
```
GET /api/jobs?q=算法&city=北京,上海&sort=relevance
  → routers/jobs.py 校验参数
  → services/job_service.list_jobs()
      ├─ SQL WHERE (recruit_type/job_category/company，多值 OR)
      ├─ 城市过滤在 Python 侧做（DB 编码问题，normalize_city_values）
      └─ 排序：relevance → _rank_jobs_by_hybrid()；latest → publish_time
  → schemas/job.py 序列化（publish_time 清洗非法日期）
```

### AI 岗位推荐
```
POST /api/ai/recommend-jobs (需邀请码)
  → check_ai_invite() 校验用户 ai_invite_verified
  → chat_service.get_profile() 读用户画像
  → build_profile_query() 拼查询文本
  → semantic_vector_scores() 向量召回 top_k
```

## 5. 关键设计决策

1. **城市过滤放在 Python 层而非 SQL**：`job_service.py` 注释明确说明 DB 存在编码乱码问题，`work_city`/`work_cities` 需经 `normalize_city_values()` 归一化（别名映射、去"市"字、海外合并）。
2. **混合检索 + RRF**：标题 BM25 + 职责/要求/加分项向量相似度，RRF(k=60) 融合，标题精确命中额外 boost（0.08 + token 重叠 0.06）。
3. **AI 多供应商降级链**：DeepSeek → Qwen → 503，单供应商失败自动切换；向量服务不可用降级为 TF-IDF 余弦。
4. **单例模型服务**：`semantic_vector_service` 全局单例 + 线程锁 + 20000 条向量缓存，避免重复加载模型。
5. **前端 React SPA**：Vite + TS 构建，无服务端渲染；开发期 Vite proxy 代理 `/api/*` 到 :8000，生产由 Nginx 反代。

## 6. 目录全景

```
daijob/
├── backend/            # FastAPI 后端
│   ├── main.py         # 入口 + lifespan + CORS(*)
│   ├── config.py       # pydantic-settings，全部配置
│   ├── database.py     # async engine（MySQL/SQLite 自适应 pool 参数）
│   ├── routers/        # auth / jobs / ai / resume_parse
│   ├── services/       # auth / job / search_utils / llm / ollama / chat / semantic_vector / resume_parse
│   ├── models/         # User / Job / UserProfile
│   ├── schemas/        # auth / job / ai / resume_parse
│   ├── scripts/        # import_jobs / clean_jobs / clean_jobs_file
│   └── tests/          # 12 个测试文件，内存 SQLite
├── frontend/           # React 前端（Vite + TS + Tailwind + zustand + TanStack Query）
│   ├── src/            # pages / components / stores / lib / hooks / types
│   └── __tests__/      # Vitest 测试
├── data/jobs.jsonl     # 7477 条校招岗位（16MB）
├── daijob.site_nginx/  # TLS 证书（crt/key/csr）
├── docs/               # 部署/调试/决策记录/设计 spec
├── Dockerfile          # 后端镜像
├── Dockerfile.nginx    # 前端 + Nginx 镜像
├── docker-compose.yml  # mysql + backend + frontend 三容器
├── deploy.sh           # 一键部署脚本
├── update.sh           # 更新脚本
└── nginx.conf          # 前端反代配置
```
