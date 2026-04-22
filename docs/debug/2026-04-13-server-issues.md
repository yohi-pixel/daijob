# 2026-04-13 服务器问题排查记录

## 问题一：IP访问无法加载

### 问题描述
通过服务器IP `124.222.88.179` 访问网站时，提示"无法访问此页面，响应时间太长"。

### 排查步骤

1. **检查nginx配置** - 发现 `nginx.conf` 中 `server_name` 只绑定了域名
2. **测试容器内部连接** - 容器内 curl 正常
3. **检查防火墙规则** - 发现 **443 端口未开放**
4. **验证SSL证书挂载** - nginx容器未正确加载nginx.conf

### 解决方案

1. 在 nginx.conf 中添加默认server块处理IP访问：
   ```nginx
   server {
       listen 80;
       listen 443 ssl;
       server_name _;  # 匹配任意主机名
       ...
   }
   ```

2. 开放防火墙443端口（通过腾讯云控制台）

3. 将nginx.conf复制到nginx容器配置目录：
   ```bash
   docker cp nginx.conf yesjob-frontend:/etc/nginx/conf.d/default.conf
   nginx -s reload
   ```

---

## 问题二：简历解析接口报错

### 问题描述
调用 `/api/resume/parse` 接口返回 500 错误。

### 排查步骤

1. **检查后端日志** - 发现 `ModuleNotFoundError: No module named 'pdfplumber'`
2. **对比依赖列表** - `resume_parse_service.py` 使用的包未在 requirements.txt 中

### 解决方案

1. 在 `backend/requirements.txt` 中添加缺失依赖：
   ```
   pdfplumber==0.11.0
   python-docx==1.1.0
   ```

2. 重新构建并部署后端容器
