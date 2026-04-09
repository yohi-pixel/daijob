# YesJob 云服务器配置文档

## 服务器信息

| 项目 | 配置 |
|------|------|
| **服务商** | 腾讯云 Lighthouse（轻量应用服务器） |
| **地域** | 上海 (ap-shanghai) |
| **实例 ID** | lhins-61o1wzd2 |
| **操作系统** | Ubuntu |
| **公网 IP** | 150.158.149.158 |
| **SSH 端口** | 22 |

## 项目路径

```
/root/YesJob_20260408215129
```

## 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    150.158.149.158                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Frontend  │  │   Backend   │  │    MySQL    │      │
│  │  (Python)   │  │  (FastAPI)  │  │  (MySQL 8)  │      │
│  │   Port:3000 │──│── Port:8080 │──│── Port:3306 │      │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘      │
│         │                │                               │
│         └────────────────┴── docker network: yesjob-net │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
                    Port 80 (Nginx)
```

## Docker 服务配置

### docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: yesjob-mysql
    environment:
      MYSQL_ROOT_PASSWORD: YesJob2024!@#
      MYSQL_DATABASE: yesjob
      MYSQL_USER: yesjob
      MYSQL_PASSWORD: root123
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - yesjob-net
    restart: unless-stopped

  backend:
    image: yesjob-backend:latest
    container_name: yesjob-backend
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: yesjob
      DB_PASSWORD: root123
      DB_NAME: yesjob
    ports:
      - "8080:8080"
    depends_on:
      - mysql
    networks:
      - yesjob-net
    restart: unless-stopped
    # 构建命令: docker build -f Dockerfile -t yesjob-backend .

  frontend:
    image: yesjob-frontend:latest
    container_name: yesjob-frontend
    environment:
      BACKEND_URL: http://backend:8080
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - yesjob-net
    restart: unless-stopped
    # 构建命令: docker build -f Dockerfile.frontend -t yesjob-frontend .

networks:
  yesjob-net:
    driver: bridge

volumes:
  mysql_data:
```

### Dockerfile (Backend)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/ ./backend/
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Dockerfile.frontend

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY index.html .
COPY pages/ pages/
COPY css/ css/
COPY js/ js/
COPY serve.py .
ENV BACKEND_URL=http://backend:8080
EXPOSE 3000
CMD ["python", "serve.py", "3000"]
```

## 数据库配置

### 连接信息

| 项目 | 值 |
|------|---|
| **Host** | mysql（容器内）/ 150.158.149.158:3306（外部） |
| **Port** | 3306 |
| **Database** | yesjob |
| **Username** | yesjob |
| **Password** | root123 |
| **Root Password** | YesJob2024!@# |

### 创建用户命令

```sql
CREATE USER 'yesjob'@'%' IDENTIFIED BY 'root123';
GRANT ALL PRIVILEGES ON yesjob.* TO 'yesjob'@'%';
FLUSH PRIVILEGES;
```

### Docker内连接MySQL

```bash
docker exec -it yesjob-mysql mysql -u yesjob -p
# 密码: root123
```

## API 服务配置

### Backend API

| 项目 | 配置 |
|------|------|
| **URL** | http://150.158.149.158:8080 |
| **容器端口** | 8080 |
| **容器名称** | yesjob-backend |
| **框架** | FastAPI + Uvicorn |

### API 端点

```
GET  /api/jobs              - 获取职位列表
GET  /api/jobs/{id}         - 获取职位详情
GET  /api/companies         - 获取公司列表
GET  /api/companies/{name}/jobs - 按公司筛选职位
```

## 前端服务配置

| 项目 | 配置 |
|------|------|
| **URL** | http://150.158.149.158 |
| **容器端口** | 3000 |
| **容器名称** | yesjob-frontend |
| **服务文件** | serve.py |

### 前端访问后端配置

```javascript
// serve.py 或前端代码中
BACKEND_URL = http://backend:8080
```

## Docker 网络

### 网络信息

```bash
# 网络名称: yesjob-net
# 驱动类型: bridge

# 连接容器到网络（如需手动操作）
docker network connect yesjob-net yesjob-frontend
docker network connect yesjob-net yesjob-backend
docker network connect yesjob-net yesjob-mysql
```

### 网络诊断

```bash
# 测试容器间连通性
docker exec yesjob-frontend ping -c 3 backend
docker exec yesjob-frontend curl -v http://backend:8080/api/jobs
```

## 常用运维命令

### 查看服务状态

```bash
# 查看容器状态
docker ps -a | grep yesjob

# 查看服务健康状态
docker inspect yesjob-backend | grep -i health
docker inspect yesjob-frontend | grep -i health
docker inspect yesjob-mysql | grep -i health
```

### 查看日志

```bash
# 后端日志
docker logs -f yesjob-backend

# 前端日志
docker logs -f yesjob-frontend

# MySQL日志
docker logs -f yesjob-mysql
```

### 重启服务

```bash
# 重启单个服务
docker restart yesjob-backend
docker restart yesjob-frontend

# 完全重建
cd /root/YesJob_20260408215129
docker-compose down && docker-compose up -d --build
```

### 进入容器调试

```bash
# 后端容器
docker exec -it yesjob-backend /bin/bash

# 前端容器
docker exec -it yesjob-frontend /bin/bash

# MySQL容器
docker exec -it yesjob-mysql /bin/bash
```

## 防火墙配置

### 已开放端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 3306 | TCP | MySQL（可选，按需开放） |
| 8080 | TCP | Backend API（可选，按需开放） |

### 开放端口命令

```bash
# 使用腾讯云控制台或CLI
# 参考: create_firewall_rules 工具
```

## 端口占用检查

```bash
# 检查80端口
netstat -tlnp | grep :80
ss -tlnp | grep :80

# 检查8080端口
netstat -tlnp | grep :8080

# 检查3306端口
netstat -tlnp | grep :3306
```

## 停止冲突服务

```bash
# 停止Nginx（如果占用80端口）
systemctl stop nginx

# 停止其他Web服务
systemctl stop apache2
```

## 快速修复

### 修复代码后直接部署（无需重建镜像）

```bash
# 1. 复制修复后的文件到容器
docker cp backend/schemas/job.py yesjob-backend:/app/backend/schemas/job.py

# 2. 重启容器
docker restart yesjob-backend

# 3. 验证修复
curl http://localhost:8080/api/jobs
```

## 环境变量参考

### Backend 环境变量

```
DB_HOST=mysql
DB_PORT=3306
DB_USER=yesjob
DB_PASSWORD=root123
DB_NAME=yesjob
```

### Frontend 环境变量

```
BACKEND_URL=http://backend:8080
```

## 更新日志

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-04-08 | 初始部署 | 完成前端、后端、MySQL部署 |
| 2026-04-08 | Bug修复 | 修复 publish_time 日期验证器 |
