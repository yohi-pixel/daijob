#!/bin/bash

# YesJob 更新脚本
# 用于更新已部署的项目

set -e

echo "=========================================="
echo "YesJob 更新脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/opt/yesjob"

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}项目目录不存在: $PROJECT_DIR${NC}"
    echo "请先运行 deploy.sh 进行初始部署"
    exit 1
fi

cd $PROJECT_DIR

# 1. 备份当前 .env 文件
echo -e "${YELLOW}[1/5] 备份配置文件...${NC}"
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}配置文件已备份${NC}"
fi

# 2. 拉取最新代码
echo -e "\n${YELLOW}[2/5] 拉取最新代码...${NC}"
git fetch origin
git pull origin main

# 3. 检查 .env 是否有新增配置项
echo -e "\n${YELLOW}[3/5] 检查配置文件...${NC}"
if [ -f .env.example ]; then
    # 提取 .env.example 中的所有配置项
    EXAMPLE_KEYS=$(grep -E '^[A-Z_]+=' .env.example | cut -d'=' -f1 | sort)
    CURRENT_KEYS=$(grep -E '^[A-Z_]+=' .env | cut -d'=' -f1 | sort)

    # 找出缺失的配置项
    MISSING_KEYS=$(comm -23 <(echo "$EXAMPLE_KEYS") <(echo "$CURRENT_KEYS"))

    if [ -n "$MISSING_KEYS" ]; then
        echo -e "${YELLOW}检测到新增配置项：${NC}"
        echo "$MISSING_KEYS"
        echo -e "${YELLOW}请手动添加到 .env 文件${NC}"
    else
        echo -e "${GREEN}配置文件无需更新${NC}"
    fi
fi

# 4. 重新构建并启动服务
echo -e "\n${YELLOW}[4/5] 重新构建服务...${NC}"
docker-compose down
docker-compose build
docker-compose up -d

# 5. 等待服务启动并检查状态
echo -e "\n${YELLOW}[5/5] 检查服务状态...${NC}"
sleep 10
docker-compose ps

# 清理旧镜像
echo -e "\n${YELLOW}清理旧镜像...${NC}"
docker image prune -f

echo -e "\n=========================================="
echo -e "${GREEN}更新完成！${NC}"
echo -e "=========================================="
echo -e "查看日志: ${YELLOW}docker-compose logs -f${NC}"
echo "=========================================="
