# 后端 API 参考

Base URL：`http://localhost:8000`（生产经 Nginx 反代）。除注册/登录外，均需 `Authorization: Bearer <token>`。

## 1. 鉴权（/api/auth）

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{username, email, password}` | `{message, user_id}` | 邮箱唯一校验 |
| POST | `/api/auth/login` | `{email, password}` | `{access_token, token_type, expires_in}` | JWT，60min 过期 |

## 2. 岗位（/api/jobs）

| 方法 | 路径 | 参数 | 响应 | 说明 |
|---|---|---|---|---|
| GET | `/api/jobs` | `q`(关键词), `city`(逗号分隔), `recruit_type`, `job_category`, `company`, `sort`(latest\|relevance), `page`, `page_size`(≤100) | `JobListResponse` | 多值筛选同字段 OR、跨字段 AND |
| GET | `/api/jobs/meta/filters` | - | `FiltersResponse` | 全量筛选项（城市按优先级排序：广州>北京>上海>深圳>杭州） |
| GET | `/api/jobs/meta/dynamic-filters` | 同筛选参数（可排除某字段） | `DynamicFiltersResponse` | 当前筛选条件下的剩余可选筛选项 |
| GET | `/api/jobs/{job_id}` | - | `JobDetail` | 完整岗位详情 |

`JobSummary` 字段：`id, job_id, company, title, recruit_type, job_category, work_city, publish_time, detail_url`
`JobDetail` 额外含：`work_cities, job_function, team_intro, responsibilities, requirements, bonus_points, tags, fetched_at`

## 3. AI 功能（/api/ai）— 除 verify-invite 外均需邀请码

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|---|---|---|---|---|
| POST | `/api/ai/verify-invite` | `{code}` | `{message}` | 校验邀请码，通过后 `ai_invite_verified=true` |
| POST | `/api/ai/match` | `{resume_text, job_ids[]}`（≤50 个岗位，简历≤5000字） | `{scores: {job_id: 0-100或null}}` | Ollama 批量打分，并发 + 失败置 null |
| POST | `/api/ai/optimize` | `{resume_text, job_id}` | `{optimized_resume, suggestions[]}` | 整份简历优化（STAR 法则），DeepSeek→Qwen 降级 |
| POST | `/api/ai/optimize-module` | `{module_type, module_data, job_id?}` | SSE 流 | 单模块优化（9 种模块类型），保持 JSON 结构 |
| POST | `/api/ai/chat` | `{message, session_id, context}` | SSE 流 | 像素精灵多轮对话，构建用户画像 |
| GET | `/api/ai/profile` | - | 画像 JSON | 返回当前用户画像 |
| POST | `/api/ai/recommend-jobs` | `{top_k}` | `{jobs: JobSummary[]}` | 画像 → 向量检索 top_k 岗位 |
| POST | `/api/ai/analyze-job-fit` | `{job_id}` | SSE 流 | 画像 × 岗位 → 简历优化建议 |
| POST | `/api/ai/extract-resume` | - | `{modules[]}` | 从对话历史提取简历模块（basic/education/experience/project/skill） |

### SSE 流格式
```
data: {"content": "文本增量"}\n\n
data: {"profile_ready": true}\n\n     # chat 中画像收集完成时
data: [DONE]\n\n
```
响应头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`（禁 Nginx 缓冲）。

### 错误约定
- 403：AI 未验证邀请码
- 400：`TOO_MANY_JOBS` / `RESUME_TOO_LONG` / 邀请码错误
- 404：岗位不存在
- 503：AI 服务不可用（无 API Key / 向量服务故障）

## 4. 简历解析（/api/resume）

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|---|---|---|---|---|
| POST | `/api/resume/parse` | multipart：`file`(PDF/DOCX) + `has_basic_info`(bool) | `ParsedResume` | 规则式解析，无 LLM 依赖 |

`ParsedResume` 结构：`{basic_info?, experiences[]: {module_type: education\|experience\|award, data}, skill?, summary?}`
`has_basic_info=true` 时丢弃 basic_info（用于已在前端填好基本信息的场景）。

## 5. 健康检查

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/health` | `{"status": "ok"}` |

## 6. 限流与校验速览

- `page_size` 上限 100（clamp 而非报错）
- `resume_text` 上限 5000 字符（报错）
- `match` job_ids 上限 50（报错）
- 对话历史窗口：最近 20 条
- CORS：`allow_origins=["*"]`（生产注意收紧）
