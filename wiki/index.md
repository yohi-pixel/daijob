# YesJob (daijob) 代码知识库

> AI 驱动的求职平台：多网站校招数据采集 + AI 简历匹配/优化 + 像素精灵求职助手
> 仓库：`yohi-pixel/daijob`（私有）｜ 项目内名：YesJob ｜ 主语言：Python (FastAPI) + Vanilla JS

## 文档索引

| 文档 | 内容 | 面向读者 |
|---|---|---|
| [architecture.md](./architecture.md) | 系统架构：三层结构、请求链路、模块职责 | 所有开发者 |
| [backend-api.md](./backend-api.md) | 全部 API 端点、请求/响应结构、鉴权方式 | 前端/联调/测试 |
| [data-model.md](./data-model.md) | 三张表结构与字段语义 | 后端/数据 |
| [search-ranking.md](./search-ranking.md) | 混合检索：BM25 + 向量 + RRF 融合、筛选规范化 | 后端/算法 |
| [ai-features.md](./ai-features.md) | AI 能力全景：匹配/优化/聊天/画像/推荐 的实现与模型策略 | 后端/AI |
| [resume-parser.md](./resume-parser.md) | 规则式简历解析（PDF/DOCX → 结构化模块） | 后端 |
| [deployment.md](./deployment.md) | Docker/Nginx 云服务器部署与一键脚本 | DevOps |
| [frontend.md](./frontend.md) | 前端页面与 JS 模块 | 前端 |

## 快速事实

- **数据来源**：`data/jobs.jsonl`（7477 条校招岗位），启动时若 `jobs` 表为空自动导入
- **数据库**：生产 MySQL 8.0（aiomysql）/ 开发测试 SQLite（aiosqlite）
- **AI 模型**：DeepSeek（主）/ Qwen（备）/ Ollama 本地（匹配打分）/ BGE-small-zh-v1.5（向量）
- **鉴权**：JWT (HS256) + bcrypt，AI 功能需邀请码 `AI_INVITE_CODE` 验证
- **当前状态**：最后人工提交 2026-04-23（22 commits），功能完整可部署

## 快速命令

```bash
# 后端
cd backend && uvicorn main:app --reload --port 8000
# 前端（含 /api 代理）
python serve.py 3000
# 测试（内存 SQLite）
cd backend && pytest
# 生产
docker-compose up --build
```
