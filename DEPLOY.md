# YesJob 快速部署指南

## 一键部署到云服务器

### 前置要求
- Ubuntu 22.04 / CentOS 8 服务器
- Root 权限
- 开放 80、443 端口

### 部署步骤

1. **SSH 连接到服务器**
```bash
ssh root@your-server-ip
```

2. **下载并运行部署脚本**
```bash
curl -fsSL https://raw.githubusercontent.com/yohi-pixel/daijob/main/deploy.sh | bash
```

或者手动克隆后部署：
```bash
git clone https://github.com/yohi-pixel/daijob.git /opt/yesjob
cd /opt/yesjob
bash deploy.sh
```

3. **配置 AI API 密钥**

部署完成后，编辑 `.env` 文件：
```bash
cd /opt/yesjob
vim .env
```

至少配置以下一项：
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `QWEN_API_KEY` - 通义千问 API 密钥

4. **重启服务**
```bash
docker-compose restart
```

5. **访问应用**

浏览器打开：`http://your-server-ip`

首次使用 AI 功能需要输入邀请码（部署时自动生成，查看 `.env` 文件中的 `AI_INVITE_CODE`）

---

## 本地开发

### 快速启动

```bash
# 克隆项目
git clone https://github.com/yohi-pixel/daijob.git
cd daijob

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写必要配置

# 一键启动（需要 Python 3.11）
bash start-dev.sh
```

访问：
- 前端：http://localhost:3000
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs

---

## 更新部署

在服务器上运行：
```bash
cd /opt/yesjob
bash update.sh
```

---

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 备份数据库
docker exec yesjob-mysql mysqldump -u yesjob -p yesjob > backup.sql
```

---

## 配置 HTTPS（可选）

1. 申请 SSL 证书（推荐使用腾讯云免费证书）

2. 下载证书文件（Nginx 格式）

3. 上传到服务器：
```bash
scp your_domain.crt root@your-server-ip:/opt/yesjob/daijob.site_nginx/daijob.site_bundle.crt
scp your_domain.key root@your-server-ip:/opt/yesjob/daijob.site_nginx/daijob.site.key
```

4. 修改 `nginx.conf` 中的域名配置

5. 重启服务：
```bash
docker-compose restart frontend
```

---

## 故障排查

### 服务无法启动
```bash
# 查看详细日志
docker-compose logs backend
docker-compose logs frontend

# 检查端口占用
netstat -tulpn | grep 8000
netstat -tulpn | grep 80
```

### AI 功能不可用
1. 检查 `.env` 中是否配置了 AI API 密钥
2. 检查邀请码是否正确
3. 查看后端日志：`docker-compose logs backend`

### 数据库连接失败
```bash
# 检查 MySQL 容器状态
docker-compose ps mysql

# 进入 MySQL 容器测试
docker exec -it yesjob-mysql mysql -u yesjob -p
```

---

## 详细文档

- [开发指南](./docs/development-guide.md)
- [腾讯云部署指南](./docs/deployment-tencent-cloud.md)
- [项目 README](./README.md)

---

## 技术支持

- GitHub Issues: https://github.com/yohi-pixel/daijob/issues
- 文档：https://github.com/yohi-pixel/daijob/tree/main/docs
