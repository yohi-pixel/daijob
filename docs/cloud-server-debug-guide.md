# 云服务器 Debug 思路

## 1. 快速定位问题

### 1.1 确定问题范围
```
错误类型判断：
├── 前端问题 → 浏览器控制台检查Network和Console
├── 后端问题 → 检查API响应和后端日志
├── 数据库问题 → 检查连接和查询日志
└── 网络问题 → ping/telnet测试连通性
```

### 1.2 快速检查清单
```bash
# 1. 容器是否运行
docker ps -a | grep your_project

# 2. 容器健康状态
docker inspect container_name | grep -i health

# 3. 端口是否监听
netstat -tlnp | grep PORT

# 4. 容器间网络连通性
docker exec container1 curl http://container2:port/health
```

## 2. 常见错误类型

### 2.1 500 Internal Server Error
```
可能原因：
1. 代码异常未捕获
2. 数据库连接失败
3. 配置错误
4. 依赖缺失

排查步骤：
1. 查看后端容器日志
2. 检查数据库连接信息
3. 验证环境变量配置
4. 检查代码语法和导入
```

### 2.2 502 Bad Gateway / 504 Gateway Timeout
```
可能原因：
1. 后端服务未启动
2. 后端服务崩溃
3. 端口配置错误
4. 负载过高超时

排查步骤：
1. 检查后端容器状态
2. 测试后端端口直接访问
3. 检查docker-compose网络配置
4. 查看后端进程日志
```

### 2.3 连接被拒绝 (Connection Refused)
```
可能原因：
1. 服务未启动
2. 端口配置错误
3. 防火墙阻止
4. Docker网络隔离

排查步骤：
1. 确认服务进程运行中
2. 检查端口绑定（0.0.0.0 vs 127.0.0.1）
3. 检查云服务器安全组
4. 检查Docker网络
```

### 2.4 DNS解析失败
```
可能原因：
1. 容器无法解析服务名
2. Docker网络配置错误
3. DNS服务器问题

排查步骤：
1. 检查docker-compose服务名
2. 确认容器在同一网络
3. 使用容器IP直接访问测试
4. 检查/etc/resolv.conf
```

## 3. 日志分析

### 3.1 Docker日志
```bash
# 查看实时日志
docker logs -f container_name

# 查看最近100行
docker logs --tail 100 container_name

# 按时间范围
docker logs --since "2026-04-08T10:00:00" container_name

# 搜索错误关键字
docker logs container_name 2>&1 | grep -i error
```

### 3.2 Nginx日志
```bash
# 错误日志
docker exec nginx tail -f /var/log/nginx/error.log

# 访问日志
docker exec nginx tail -f /var/log/nginx/access.log
```

### 3.3 应用日志
```bash
# Python应用
docker logs -f backend | grep -E "(ERROR|Exception|Traceback)"

# Node应用
docker logs -f frontend | grep -E "(Error|warn|verbose)"
```

## 4. 数据库问题排查

### 4.1 连接测试
```bash
# 从容器内测试MySQL连接
docker exec -it mysql mysql -u user -p -h localhost

# 使用telnet测试端口
telnet mysql_host 3306

# 使用nc测试连通性
nc -zv mysql_host 3306
```

### 4.2 常见数据库错误
```
错误：Access denied
→ 检查用户名密码是否正确
→ 检查用户权限配置
→ 确认密码加密方式（mysql_native_password vs caching_sha2_password）

错误：Unknown database
→ 确认数据库是否已创建
→ 检查连接时指定的数据库名

错误：Table doesn't exist
→ 运行数据库迁移脚本
→ 检查ORM模型同步
```

## 5. 网络调试

### 5.1 容器网络
```bash
# 查看网络列表
docker network ls

# 查看网络详情
docker network inspect network_name

# 测试容器间通信
docker exec container1 ping -c 3 container2
docker exec container1 curl -v http://container2:port/health
```

### 5.2 主机网络
```bash
# 检查端口占用
netstat -tlnp | grep :80
ss -tlnp | grep :8080

# 检查防火墙
iptables -L -n
ufw status
```

### 5.3 云服务器安全组
```
检查项：
1. 入站规则是否允许访问
2. 端口范围是否正确
3. 来源IP是否限制过严
4. 协议类型是否匹配（TCP/UDP）
```

## 6. 快速修复命令

### 6.1 重启服务
```bash
# 重启单个容器
docker restart container_name

# 重启所有服务
docker-compose restart

# 完全重建
docker-compose down && docker-compose up -d
```

### 6.2 进入容器调试
```bash
# 进入容器bash
docker exec -it container_name /bin/bash

# 进入MySQL
docker exec -it mysql mysql -u root -p

# 进入Python shell
docker exec -it backend python
```

### 6.3 文件操作
```bash
# 复制文件到容器
docker cp ./fix.py container_name:/app/

# 从容器复制文件
docker cp container_name:/app/logs/error.log ./

# 修改容器内文件
docker exec container_name sed -i 's/old/new/g' /app/config.py
```

## 7. Debug流程图

```
发现问题
    ↓
检查前端控制台（Network/Console）
    ↓
确认是前端还是后端问题
    ↓
┌─────────────────────────────┐
│ 前端问题                     │
│ → 检查静态资源是否加载       │
│ → 检查API请求地址           │
│ → 检查CORS配置              │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ 后端问题                     │
│ → 查看后端日志               │
│ → 测试API直接访问           │
│ → 检查数据库连接            │
└─────────────────────────────┘
    ↓
定位具体错误
    ↓
修复并验证
```

## 8. 常用调试工具

```bash
# curl测试API
curl -X GET "http://localhost:8080/api/jobs" -H "Content-Type: application/json"

# 查看进程
ps aux | grep docker
top -p $(docker inspect --format '{{.State.Pid}}' container_name)

# 监控资源使用
docker stats

# 检查磁盘
df -h
docker system df
```
