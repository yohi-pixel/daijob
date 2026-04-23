# YesJob 开发指南

## 快速启动

### 前置要求

- Python 3.11（推荐）或 3.10
- Node.js 16+ (仅用于 Tailwind CSS 构建)
- Git

### 1. 克隆项目

```bash
git clone <repository-url>
cd YesJob
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写必要的配置：

```bash
cp .env.example .env
```

必填配置项：
- `DATABASE_URL`: 数据库连接字符串（开发环境可用 SQLite）
- `SECRET_KEY`: JWT 密钥
- `DEEPSEEK_API_KEY` 或 `QWEN_API_KEY`: AI 服务 API 密钥
- `EMBEDDING_MODEL`: 向量模型路径（用于岗位推荐）
- `AI_INVITE_CODE`: AI 功能邀请码

### 3. 启动后端

#### 创建虚拟环境（首次）

```bash
# 使用 Python 3.11（推荐）
python3.11 -m venv .venv311
```

**注意**：项目要求 Python 3.11 或 3.10，不支持 Python 3.14（SQLAlchemy 兼容性问题）。

#### 激活虚拟环境并安装依赖

**Windows (Git Bash):**
```bash
source .venv311/Scripts/activate
pip install -r backend/requirements.txt
```

**Linux/Mac:**
```bash
source .venv311/bin/activate
pip install -r backend/requirements.txt
```

#### 启动后端服务

```bash
cd backend
uvicorn main:app --reload --port 8000
```

成功启动后会看到：
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Application startup complete.
```

后端 API 文档：http://127.0.0.1:8000/docs

### 4. 启动前端

在**新的终端窗口**中：

```bash
cd YesJob
python serve.py 3000
```

前端服务：http://127.0.0.1:3000

`serve.py` 会自动将 `/api/*` 请求代理到后端 `http://127.0.0.1:8000`。

---

## 常见问题

### 问题 1: `uvicorn: command not found`

**原因**：未激活虚拟环境或虚拟环境中未安装依赖。

**解决方案**：
```bash
# 激活虚拟环境
source .venv311/Scripts/activate  # Windows Git Bash
source .venv311/bin/activate      # Linux/Mac

# 安装依赖
pip install -r backend/requirements.txt
```

### 问题 2: SQLAlchemy 报错 `TypeError: Can't replace canonical symbol`

**原因**：Python 3.14 与 SQLAlchemy 2.x 存在兼容性问题。

**解决方案**：使用 Python 3.11 或 3.10：
```bash
# 删除旧虚拟环境（如果存在）
rm -rf .venv

# 使用 Python 3.11 创建虚拟环境
python3.11 -m venv .venv311
source .venv311/Scripts/activate  # Windows Git Bash
source .venv311/bin/activate      # Linux/Mac
pip install -r backend/requirements.txt
```

### 问题 3: 后端启动后无法访问（端口未监听）

**排查步骤**：

1. 检查后端日志是否有 "Application startup complete"：
   ```bash
   cat backend.log
   ```

2. 检查端口是否被占用：
   ```bash
   # Windows
   netstat -an | findstr 8000
   
   # Linux/Mac
   lsof -i :8000
   ```

3. 如果端口被占用，杀掉占用进程或更换端口：
   ```bash
   uvicorn main:app --reload --port 8001
   ```

### 问题 4: 前端无法连接后端 API

**原因**：后端未启动或端口配置不匹配。

**解决方案**：
1. 确认后端在 8000 端口运行
2. 检查 `serve.py` 中的代理配置（默认代理到 `http://127.0.0.1:8000`）
3. 如果后端使用其他端口，修改 `serve.py` 第 30 行左右的 `BACKEND_URL`

### 问题 5: AI 功能提示"需要邀请码"

**原因**：`.env` 中未配置 `AI_INVITE_CODE` 或用户未验证邀请码。

**解决方案**：
1. 在 `.env` 中设置邀请码：
   ```
   AI_INVITE_CODE=your_invite_code_here
   ```
2. 重启后端服务
3. 在前端点击像素小人，输入邀请码验证

### 问题 6: 向量搜索/岗位推荐失败

**原因**：未配置 `EMBEDDING_MODEL` 或模型文件不存在。

**解决方案**：
1. 下载 BGE-small-zh 模型：
   ```bash
   # 使用 Hugging Face CLI
   huggingface-cli download BAAI/bge-small-zh-v1.5 --local-dir ./models/bge-small-zh
   ```

2. 在 `.env` 中配置模型路径：
   ```
   EMBEDDING_MODEL=./models/bge-small-zh
   ```

3. 重启后端服务

---

## 开发工作流

### 修改前端代码

前端使用原生 HTML/JS/CSS + Tailwind，修改后刷新浏览器即可看到效果。

如果修改了 Tailwind 类名，需要重新构建 CSS：
```bash
npm run build:css
```

### 修改后端代码

后端使用 `--reload` 模式启动，修改 Python 文件后会自动重启。

如果修改了数据库模型，需要手动迁移（项目暂未使用 Alembic）：
```bash
# 删除旧数据库（开发环境）
rm data/yesjob.db

# 重启后端，会自动创建新表
```

### 运行测试

```bash
cd backend
pytest                          # 运行所有测试
pytest tests/test_auth.py       # 运行单个测试文件
pytest -v -s                    # 显示详细输出
```

---

## 生产部署

### 使用 Docker Compose

```bash
docker-compose up --build -d
```

服务端口：
- 前端 Nginx: 80
- 后端 API: 8000（内部）

### 手动部署

1. 构建前端静态资源：
   ```bash
   npm run build:css
   ```

2. 配置 Nginx 反向代理（参考 `nginx.conf`）

3. 使用 Gunicorn + Uvicorn 运行后端：
   ```bash
   cd backend
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

---

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
├── css/                 # 样式文件
├── serve.py             # 开发服务器（带 API 代理）
├── .env                 # 环境变量配置
└── docs/                # 文档
```

---

## 技术栈

- **后端**: FastAPI + SQLAlchemy 2.0 + AsyncOpenAI
- **前端**: Vanilla JS + Tailwind CSS + Canvas API
- **数据库**: SQLite (开发) / MySQL (生产)
- **AI**: DeepSeek / Qwen API + BGE-small-zh 向量模型
- **部署**: Docker + Nginx

---

## 相关文档

- [CLAUDE.md](../CLAUDE.md) - Claude Code 开发指南
- [API 文档](http://127.0.0.1:8000/docs) - FastAPI 自动生成的 API 文档
- [AI 聊天增强功能设计](./superpowers/specs/2026-04-22-ai-chat-enhancements-design.md)
