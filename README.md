# YesJob - AI 驱动的求职平台

YesJob 是一个智能求职平台，提供 AI 简历匹配、岗位推荐和简历优化功能。

## 快速开始

### 环境要求

- **Python 3.11** 或 3.10（⚠️ 不支持 Python 3.14）
- Node.js 16+
- Git

### 安装与启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd YesJob

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填写必要配置

# 3. 创建虚拟环境（使用 Python 3.11）
python3.11 -m venv .venv311
source .venv311/Scripts/activate  # Windows Git Bash
# source .venv311/bin/activate    # Linux/Mac

# 4. 安装后端依赖
pip install -r backend/requirements.txt

# 5. 启动后端（新终端）
cd backend
uvicorn main:app --reload --port 8000

# 6. 启动前端（新终端）
cd YesJob
python serve.py 3000
```

访问 http://localhost:3000 开始使用。

## 功能特性

- 🎯 **AI 求职助手**：像素精灵浮窗，多轮对话构建用户画像
- 📝 **智能简历管理**：模块化简历编辑，支持多版本快照
- 🔍 **语义岗位搜索**：基于向量相似度的智能岗位推荐
- ✨ **简历优化**：针对特定 JD 的 AI 简历优化建议
- 📊 **匹配度分析**：简历与岗位的智能匹配评分

## 技术栈

- **后端**: FastAPI + SQLAlchemy 2.0 + AsyncOpenAI
- **前端**: Vanilla JS + Tailwind CSS + Canvas API
- **AI**: DeepSeek/Qwen API + BGE-small-zh 向量模型
- **数据库**: SQLite (开发) / MySQL (生产)

## 文档

- [开发指南](./docs/development-guide.md) - 详细的启动流程和问题排查
- [CLAUDE.md](./CLAUDE.md) - Claude Code 开发指南
- [API 文档](http://127.0.0.1:8000/docs) - FastAPI 自动生成

## 项目结构

```
YesJob/
├── backend/              # FastAPI 后端
│   ├── main.py          # 应用入口
│   ├── routers/         # API 路由
│   ├── services/        # 业务逻辑
│   ├── models/          # 数据库模型
│   └── tests/           # 单元测试
├── pages/               # 前端页面
├── js/                  # 前端 JS 模块
│   ├── pixel-assistant.js  # AI 助手浮窗
│   ├── resume-store.js     # 简历数据管理
│   └── resume-pdf.js       # 简历导出
├── css/                 # 样式文件
├── serve.py             # 开发服务器
└── docs/                # 文档
```

## 常见问题

### Python 版本问题

⚠️ **项目不支持 Python 3.14**，会导致 SQLAlchemy 兼容性错误。请使用 Python 3.11 或 3.10。

如果遇到 `TypeError: Can't replace canonical symbol` 错误：
```bash
rm -rf .venv
python3.11 -m venv .venv311
source .venv311/Scripts/activate
pip install -r backend/requirements.txt
```

### AI 功能邀请码

首次使用 AI 功能需要输入邀请码。邀请码在 `.env` 文件的 `AI_INVITE_CODE` 中配置。

### 更多问题

查看 [开发指南](./docs/development-guide.md) 获取详细的问题排查步骤。

## License

MIT
