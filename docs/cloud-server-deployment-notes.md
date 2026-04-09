# 云服务器部署注意事项

## 1. 环境确认

### 1.1 服务器基础信息
- 确认服务器地域（不同地域内网不通）
- 检查操作系统版本（Ubuntu/CentOS/Debian）
- 确认公网IP和SSH端口
- 验证Docker是否已安装

### 1.2 网络相关
- 检查端口占用情况：`netstat -tlnp` 或 `ss -tlnp`
- 常用端口：80(HTTP)、443(HTTPS)、3306(MySQL)、8080(Backend)
- 防火墙规则：`ufw status` 或 `iptables -L`
- 云服务器安全组需开放对应端口

### 1.3 Docker环境
- 检查Docker版本：`docker --version`
- 检查docker-compose版本：`docker-compose --version`
- 确保Docker服务运行中：`systemctl status docker`

## 2. 项目部署前检查

### 2.1 本地准备
```bash
# 项目必须包含
- Dockerfile 或 Dockerfile.frontend
- docker-compose.yml
- 依赖文件（requirements.txt、package.json等）
- 构建产物（dist/、build/）
```

### 2.2 环境变量
```bash
# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_db

# 后端配置
BACKEND_PORT=8080
FRONTEND_PORT=3000
```

### 2.3 Docker网络
```bash
# 创建专用网络（容器间通信）
docker network create your-project-net

# 或在docker-compose.yml中定义
networks:
  your-net:
    driver: bridge
```

## 3. 常见问题预防

### 3.1 镜像更新问题
```bash
# 强制重新构建镜像
docker build --no-cache -t image:tag .

# 或删除旧镜像
docker rmi $(docker images -f "dangling=true" -q)
```

### 3.2 容器间通信
```bash
# 确保容器在同一网络
docker network connect your-net container_name

# 检查网络连接
docker exec container1 ping container2
```

### 3.3 数据库连接
```bash
# 创建数据库用户（授权远程访问）
CREATE USER 'username'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON dbname.* TO 'username'@'%';
FLUSH PRIVILEGES;

# 测试连接
docker exec -it mysql mysql -u username -p -h localhost
```

### 3.4 Nginx冲突
```bash
# 检查80端口占用
lsof -i :80
netstat -tlnp | grep :80

# 停止Nginx
systemctl stop nginx
# 或修改Nginx端口
```

## 4. 部署流程

### 4.1 标准流程
```bash
# 1. 上传项目到服务器
scp -r ./project user@server:/root/

# 2. 进入项目目录
cd /root/project

# 3. 构建并启动
docker-compose up -d --build

# 4. 检查状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 4.2 快速修复（无需重新构建）
```bash
# 直接复制文件到运行中的容器
docker cp ./fixed_file.py container_name:/app/

# 重启容器
docker restart container_name
```

## 5. 安全注意事项

### 5.1 敏感信息
- 不在代码中硬编码密码
- 使用环境变量或Docker Secret
- .env文件不提交到Git

### 5.2 权限控制
```bash
# 避免以root运行容器
USER nodejs

# 限制容器资源
docker run --memory=512m --cpus=0.5
```

### 5.3 定期维护
```bash
# 清理未使用的资源
docker system prune -f

# 检查磁盘空间
df -h
docker system df
```

## 6. Lighthouse部署特殊说明

### 6.1 部署工具使用
- 使用 `analyze_lighthouse_instances` 获取地域信息
- 使用 `describe_running_instances` 获取运行中的实例
- 使用 `deploy_project_preparation` 上传项目文件

### 6.2 TAT自动化
- 确认服务器已安装TAT agent
- 使用 `execute_command` 执行远程命令
- 部署前检查防火墙规则

### 6.3 端口管理
- Lighthouse需手动开放端口（使用 `create_firewall_rules`）
- 默认只开放22(SSH)和3389(RDP)
- Web服务需开放80/443端口
