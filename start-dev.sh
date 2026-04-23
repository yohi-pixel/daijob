#!/bin/bash

# YesJob 快速启动脚本（本地开发）
# 用于本地开发环境快速启动前后端

set -e

echo "=========================================="
echo "YesJob 本地开发环境启动"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 Python 版本
echo -e "${YELLOW}检查 Python 版本...${NC}"
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD=python3.11
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD=python3.10
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [ "$PYTHON_VERSION" = "3.11" ] || [ "$PYTHON_VERSION" = "3.10" ]; then
        PYTHON_CMD=python3
    else
        echo -e "${RED}需要 Python 3.11 或 3.10，当前版本: $PYTHON_VERSION${NC}"
        exit 1
    fi
else
    echo -e "${RED}未找到 Python 3.11 或 3.10${NC}"
    exit 1
fi

echo -e "${GREEN}使用 Python: $PYTHON_CMD${NC}"

# 检查虚拟环境
if [ ! -d ".venv311" ]; then
    echo -e "${YELLOW}创建虚拟环境...${NC}"
    $PYTHON_CMD -m venv .venv311
fi

# 激活虚拟环境
echo -e "${YELLOW}激活虚拟环境...${NC}"
source .venv311/bin/activate 2>/dev/null || source .venv311/Scripts/activate

# 安装依赖
if [ ! -f ".venv311/.installed" ]; then
    echo -e "${YELLOW}安装后端依赖...${NC}"
    pip install -r backend/requirements.txt
    touch .venv311/.installed
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}创建 .env 文件...${NC}"
    cp .env.example .env
    echo -e "${RED}请编辑 .env 文件，配置必要的环境变量${NC}"
    exit 1
fi

# 启动后端
echo -e "\n${GREEN}启动后端服务...${NC}"
cd backend
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo -e "${GREEN}启动前端服务...${NC}"
python serve.py 3000 &
FRONTEND_PID=$!

# 等待服务启动
sleep 2

echo -e "\n=========================================="
echo -e "${GREEN}服务启动成功！${NC}"
echo -e "=========================================="
echo -e "前端: ${GREEN}http://localhost:3000${NC}"
echo -e "后端: ${GREEN}http://localhost:8000${NC}"
echo -e "API 文档: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo "=========================================="

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
