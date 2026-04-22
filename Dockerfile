FROM python:3.11-slim

WORKDIR /app

# 配置清华镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖文件
COPY backend/requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY backend/ .

# 创建 data 目录
RUN mkdir -p /app/data

# 复制职位数据文件
COPY data/jobs.jsonl /app/data/jobs.jsonl

# 暴露端口
EXPOSE 8080

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
