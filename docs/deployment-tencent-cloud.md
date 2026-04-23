# 腾讯云轻量应用服务器部署指南

本文档介绍如何将 YesJob 项目部署到腾讯云轻量应用服务器。

## 一、服务器配置要求

### 推荐配置
- **CPU**: 2核
- **内存**: 4GB
- **存储**: 60GB SSD
- **带宽**: 5Mbps
- **操作系统**: Ubuntu 22.04 LTS 或 CentOS 8

### 最低配置
- **CPU**: 1核
- **内存**: 2GB
- **存储**: 40GB
- **带宽**: 3Mbps

## 二、前置准备

### 1. 购买并配置服务器

1. 登录腾讯云控制台，购买轻量应用服务器
2. 选择 Ubuntu 22.04 LTS 镜像
3. 配置防火墙规则，开放以下端口：
   - **80** (HTTP)
   - **443** (HTTPS)
   - **22** (SSH，用于管理)
   - **8000** (可选，用于直接访问后端 API)

### 2. 域名配置（可选）

如果使用域名访问：
1. 在腾讯云 DNS 解析中添加 A 记录，指向服务器公网 IP
2. 申请 SSL 证书（腾讯云提供免费证书）
3. 下载证书文件（Nginx 格式）

### 3. 连接服务器

```bash
ssh root@your-server-ip
```

## 三、服务器环境配置

### 1. 更新系统

```bash
apt update && apt upgrade -y
```

### 2. 安装 Docker 和 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
apt install docker-compose -y

# 验证安装
docker --version
docker-compose --version
```

### 3. 安装 Git

```bash
apt install git -y
```

## 四、部署项目

### 1. 克隆项目到服务器

```bash
# 创建项目目录
mkdir -p /opt/yesjob
cd /opt/yesjob

# 克隆项目（替换为你的仓库地址）
git clone <your-repository-url> .
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

**必须配置的环境变量**：

```bash
# 数据库配置（使用 Docker Compose 中的 MySQL）
DATABASE_URL=mysql+aiomysql://yesjob:yesjob123@mysql:3306/yesjob

# JWT 密钥（生成随机密钥）
SECRET_KEY=$(openssl rand -hex 32)

# AI 服务配置（至少配置一个）
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 或使用通义千问
QWEN_API_KEY=your_qwen_api_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus

# 向量模型路径（用于岗位推荐）
EMBEDDING_MODEL=/app/models/bge-small-zh

# AI 功能邀请码
AI_INVITE_CODE=your_invite_code_here

# 职位数据文件
JOBS_FILE=/app/data/jobs.jsonl
```

### 3. 准备向量模型（可选，用于岗位推荐）

如果需要使用岗位推荐功能，需要下载 BGE-small-zh 模型：

```bash
# 安装 Hugging Face CLI
pip install huggingface-hub

# 下载模型到 models 目录
mkdir -p models
huggingface-cli download BAAI/bge-small-zh-v1.5 --local-dir ./models/bge-small-zh
```

**或者**在 Dockerfile 中添加模型下载步骤（见下文"修改 Dockerfile"）。

### 4. 配置 SSL 证书（如果使用 HTTPS）

```bash
# 创建 SSL 证书目录
mkdir -p daijob.site_nginx

# 上传证书文件到服务器
# 方式1: 使用 scp 从本地上传
scp your_domain.crt root@your-server-ip:/opt/yesjob/daijob.site_nginx/daijob.site_bundle.crt
scp your_domain.key root@your-server-ip:/opt/yesjob/daijob.site_nginx/daijob.site.key

# 方式2: 直接在服务器上创建文件
vim daijob.site_nginx/daijob.site_bundle.crt  # 粘贴证书内容
vim daijob.site_nginx/daijob.site.key         # 粘贴私钥内容
```

**如果不使用 HTTPS**，需要修改 `nginx.conf`（见下文"修改 Nginx 配置"）。

### 5. 修改 Docker Compose 配置

编辑 `docker-compose.yml`，根据需要调整配置：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: yesjob-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root123}
      MYSQL_DATABASE: yesjob
      MYSQL_USER: yesjob
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-yesjob123}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./data/init.sql:/docker-entrypoint-initdb.d/init.sql  # 可选：初始化脚本
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - yesjob-net
    restart: unless-stopped  # 添加自动重启

  backend:
    build: .
    container_name: yesjob-backend
    env_file:
      - .env  # 从 .env 文件读取环境变量
    ports:
      - "8000:8080"
    volumes:
      - ./data:/app/data  # 持久化数据目录
      - ./models:/app/models  # 挂载向量模型（如果有）
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - yesjob-net
    restart: unless-stopped  # 添加自动重启

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.nginx
    container_name: yesjob-frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./daijob.site_nginx:/etc/nginx/ssl:ro  # SSL 证书
    depends_on:
      - backend
    networks:
      - yesjob-net
    restart: unless-stopped  # 添加自动重启

volumes:
  mysql_data:

networks:
  yesjob-net:
    driver: bridge
```

### 6. 修改 Nginx 配置（如果不使用 HTTPS）

如果不使用 HTTPS，编辑 `nginx.conf`，移除 SSL 相关配置：

```nginx
server {
    listen 80;
    server_name _;  # 或替换为你的域名

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # 静态文件
    root /usr/share/nginx/html;
    index index.html;

    # 静态文件缓存策略
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # HTML不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store";
    }

    # API反向代理到backend
    location /api/ {
        proxy_pass http://yesjob-backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SPA路由支持
    location /pages/ {
        alias /usr/share/nginx/html/pages/;
        try_files $uri $uri/ =404;
    }

    # 默认路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 7. 修改 Dockerfile（可选优化）

如果需要在构建时下载向量模型，修改 `Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# 配置清华镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖文件
COPY backend/requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY backend/ .

# 创建 data 和 models 目录
RUN mkdir -p /app/data /app/models

# 复制职位数据文件
COPY data/jobs.jsonl /app/data/jobs.jsonl

# 可选：下载向量模型（如果不通过 volume 挂载）
# RUN pip install huggingface-hub && \
#     huggingface-cli download BAAI/bge-small-zh-v1.5 --local-dir /app/models/bge-small-zh

# 暴露端口
EXPOSE 8080

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 8. 构建并启动服务

```bash
# 构建镜像
docker-compose build

# 启动服务（后台运行）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 9. 验证部署

```bash
# 检查容器状态
docker ps

# 测试后端 API
curl http://localhost:8000/api/jobs?page=1

# 测试前端（在浏览器中访问）
# http://your-server-ip
# 或 https://your-domain.com
```

## 五、数据初始化

### 1. 导入岗位数据

如果有岗位数据文件 `jobs.jsonl`，确保已放在 `data/` 目录下。

### 2. 创建管理员账号（可选）

```bash
# 进入后端容器
docker exec -it yesjob-backend bash

# 使用 Python 创建管理员
python -c "
from database import SessionLocal
from models.user import User
from services.auth_service import get_password_hash

db = SessionLocal()
admin = User(
    username='admin',
    email='admin@example.com',
    hashed_password=get_password_hash('admin123'),
    is_active=True
)
db.add(admin)
db.commit()
print('Admin user created')
"

# 退出容器
exit
```

## 六、日常运维

### 1. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### 2. 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

### 3. 更新代码

```bash
cd /opt/yesjob

# 拉取最新代码
git pull

# 重新构建并启动
docker-compose down
docker-compose build
docker-compose up -d
```

### 4. 备份数据库

```bash
# 备份 MySQL 数据
docker exec yesjob-mysql mysqldump -u yesjob -pyesjob123 yesjob > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i yesjob-mysql mysql -u yesjob -pyesjob123 yesjob < backup_20260423.sql
```

### 5. 清理 Docker 资源

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune
```

## 七、性能优化

### 1. 启用 Nginx 缓存

在 `nginx.conf` 中添加：

```nginx
# 在 http 块中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

# 在 location /api/ 中添加
location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://yesjob-backend:8080;
    # ... 其他配置
}
```

### 2. 配置 Gunicorn 多进程

修改 `Dockerfile` 的启动命令：

```dockerfile
# 安装 gunicorn
RUN pip install gunicorn

# 修改启动命令（根据 CPU 核心数调整 workers）
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8080"]
```

### 3. 数据库连接池优化

在 `backend/database.py` 中调整连接池参数：

```python
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,          # 连接池大小
    max_overflow=10,       # 最大溢出连接数
    pool_pre_ping=True,    # 连接前检查
    pool_recycle=3600,     # 连接回收时间（秒）
)
```

## 八、监控和告警

### 1. 安装监控工具（可选）

```bash
# 安装 ctop（容器监控）
wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
chmod +x /usr/local/bin/ctop

# 运行监控
ctop
```

### 2. 配置日志轮转

创建 `/etc/logrotate.d/docker-containers`：

```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

## 九、安全加固

### 1. 配置防火墙

```bash
# 安装 ufw
apt install ufw -y

# 允许 SSH
ufw allow 22/tcp

# 允许 HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

### 2. 修改默认密码

修改 `.env` 和 `docker-compose.yml` 中的默认密码：
- MySQL root 密码
- MySQL 用户密码
- JWT SECRET_KEY
- AI_INVITE_CODE

### 3. 限制 API 访问频率

在 `backend/main.py` 中添加限流中间件（需要安装 `slowapi`）：

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/jobs")
@limiter.limit("100/minute")
async def get_jobs(request: Request):
    # ...
```

## 十、故障排查

### 问题 1: 容器无法启动

```bash
# 查看容器日志
docker-compose logs backend

# 检查端口占用
netstat -tulpn | grep 8000

# 检查磁盘空间
df -h
```

### 问题 2: 数据库连接失败

```bash
# 检查 MySQL 容器状态
docker-compose ps mysql

# 进入 MySQL 容器测试连接
docker exec -it yesjob-mysql mysql -u yesjob -pyesjob123 yesjob

# 检查网络连通性
docker exec yesjob-backend ping mysql
```

### 问题 3: 前端无法访问后端 API

```bash
# 检查 Nginx 配置
docker exec yesjob-frontend nginx -t

# 查看 Nginx 日志
docker-compose logs frontend

# 测试后端 API
curl http://yesjob-backend:8080/api/jobs?page=1
```

### 问题 4: SSL 证书错误

```bash
# 检查证书文件权限
ls -la daijob.site_nginx/

# 验证证书有效性
openssl x509 -in daijob.site_nginx/daijob.site_bundle.crt -text -noout
```

## 十一、成本优化建议

1. **使用腾讯云 COS 存储静态资源**：将图片、CSS、JS 等静态文件上传到 COS，减少服务器带宽消耗
2. **配置 CDN 加速**：使用腾讯云 CDN 加速静态资源访问
3. **定期清理日志**：配置日志轮转，避免磁盘占满
4. **使用按量计费的 AI API**：根据实际使用量选择合适的 AI 服务套餐
5. **数据库定期备份到 COS**：避免数据丢失，同时节省服务器存储空间

## 相关文档

- [开发指南](./development-guide.md)
- [CLAUDE.md](../CLAUDE.md)
- [Docker 官方文档](https://docs.docker.com/)
- [腾讯云轻量应用服务器文档](https://cloud.tencent.com/document/product/1207)
