# 部署

生产环境：Docker Compose 三容器（MySQL + 后端 + Nginx 前端） + 云服务器。配套一键脚本 `deploy.sh` / `update.sh`。

## 1. 架构

```
公网 :80/:443
  └─ Nginx (frontend 容器, Dockerfile.nginx)
      ├─ 静态资源 (frontend/dist/)
      ├─ /api/* → 反代 backend:8080
      └─ TLS 证书: daijob.site_nginx/ (crt/key/csr)
            │
后端容器 (Dockerfile, uvicorn :8080)
  └─ MySQL 8.0 (mysql 容器, :3306, 卷 mysql_data)
```

## 2. docker-compose.yml 要点

| 服务 | 镜像 | 端口 | 挂载 | 依赖 |
|---|---|---|---|---|
| mysql | mysql:8.0 | 3306:3306 | mysql_data 卷 | - |
| backend | 本地 Dockerfile | 8000:8080 | ./data、./models | mysql healthy |
| frontend | Dockerfile.nginx | 80:80, 443:443 | daijob.site_nginx → /etc/nginx/ssl | backend |

- 环境变量：`MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`（默认 root123 / yesjob123，**生产必改**）
- backend 通过 `env_file: .env` 注入配置（`DATABASE_URL=mysql+aiomysql://yesjob:yesjob123@mysql:3306/yesjob`）
- 三容器同网 `yesjob-net`，backend 健康检查前 mysql 不启动

## 3. 一键部署（deploy.sh）

```bash
curl -fsSL https://raw.githubusercontent.com/yohi-pixel/daijob/main/deploy.sh | bash
# 或
git clone https://github.com/yohi-pixel/daijob.git /opt/yesjob && cd /opt/yesjob && bash deploy.sh
```

前置要求：Ubuntu 22.04 / CentOS 8、root、开放 80/443。
部署后配置 `.env`：至少一个 `DEEPSEEK_API_KEY` 或 `QWEN_API_KEY`。

## 4. 更新（update.sh）

拉取 main → 重建镜像 → 滚动更新容器。

## 5. 开发模式（无 Docker）

```bash
# 后端（SQLite）
cd backend && cp ../.env.example .env   # 改 DATABASE_URL 为 sqlite
uvicorn main:app --reload --port 8000

# 前端（Vite dev server，/api 代理到 :8000）
cd frontend && npm run dev   # http://localhost:5173，/api/* → localhost:8000
```

## 6. Nginx 关键配置（nginx.conf / Dockerfile.nginx）

- `/api/*` 反代 backend，`X-Accel-Buffering: no` 已由后端 SSE 响应头设置，保证流式推送不缓冲
- TLS 挂载于 `/etc/nginx/ssl`（daijob.site 域证书，含 bundle）

## 7. 运维注意

- `.env` 不入库（gitignore）；生产密钥：SECRET_KEY 用 `openssl rand -hex 32` 生成
- `AI_INVITE_CODE` 默认 `AYOHI2026`，上线必须改
- CORS `allow_origins=["*"]`，若限制域名需收紧
- 数据文件 `data/jobs.jsonl`（16MB/7477 条）已入库，但爬虫更新在公开 yohi-pixel/YesJob（数据采集版）仓库的 CI 中每周跑，需要手动合并新数据
- 证书文件（crt/key）**已入库**——私有仓库可接受，若转公开需清理
