# 逮JOB - AI 驱动的求职平台

逮JOB 是一个智能求职平台，提供 AI 简历匹配、岗位推荐和简历优化功能。多网站校园招聘数据采集（Scrapy + Playwright）+ AI 求职助手。

## 快速开始

### 环境要求

- **Python 3.13**（后端，SQLAlchemy ≥2.0.31）
- **Node.js 20+**（前端）
- Git

### 安装与启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd daijob

# 2. 配置后端环境变量
cp .env.example backend/.env
# 编辑 backend/.env 填写必要配置（本地开发用 SQLite，见 .env.example 注释）

# 3. 安装后端依赖并启动（端口 8000）
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 4. 安装前端依赖并启动（端口 5173，/api 自动代理到后端）
cd ../frontend
npm install
npm run dev
```

访问 http://localhost:5173 开始使用。

## 功能特性

- 🎯 **AI 求职助手**：像素精灵浮窗，多轮对话构建用户画像
- 📝 **智能简历管理**：模块化简历编辑，支持多版本快照
- 🔍 **语义岗位搜索**：基于向量相似度的智能岗位推荐
- ✨ **简历优化**：针对特定 JD 的 AI 简历优化建议
- 📊 **匹配度分析**：简历与岗位的智能匹配评分

## 技术栈

- **后端**: FastAPI + SQLAlchemy 2.0 (async) + AsyncOpenAI
- **前端**: React 18 + TypeScript + Tailwind CSS + zustand + TanStack Query
- **AI**: DeepSeek/Qwen API + BGE-small-zh 向量模型
- **数据库**: SQLite (开发) / MySQL (生产)

## 文档

- [开发指南](./docs/development-guide.md) - 详细的启动流程和问题排查
- [CLAUDE.md](./CLAUDE.md) - 开发指南
- [API 文档](http://127.0.0.1:8000/docs) - FastAPI 自动生成
- [代码知识库](./wiki/index.md) - 架构/API/数据模型/AI 功能文档

## 项目结构

```
daijob/
├── backend/              # FastAPI 后端
│   ├── main.py          # 应用入口
│   ├── routers/         # API 路由
│   ├── services/        # 业务逻辑
│   ├── models/          # 数据库模型
│   └── tests/           # 单元测试
├── frontend/            # React 前端（独立 npm 项目）
│   ├── src/             # 组件/页面/状态/store
│   ├── __tests__/       # Vitest 测试
│   └── vite.config.ts   # Vite 配置（/api 代理到 :8000）
├── data/                # 岗位数据（jobs.jsonl）
├── docs/                # 部署/开发文档
├── wiki/                # 代码知识库
└── docker-compose.yml   # 生产部署（MySQL + 后端 + Nginx 前端）
```

## 常见问题

### 本地启动后岗位列表为空

`backend/.env` 中 `JOBS_FILE` 需指向数据文件：本地开发用 `JOBS_FILE=../data/jobs.jsonl`（相对 backend 目录）。

### AI 功能邀请码

首次使用 AI 功能需要输入邀请码。邀请码在 `backend/.env` 文件的 `AI_INVITE_CODE` 中配置。

### 更多问题

查看 [开发指南](./docs/development-guide.md) 获取详细的问题排查步骤。

## License

MIT
