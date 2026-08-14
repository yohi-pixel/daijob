#!/bin/bash

# 逮JOB 一键部署脚本
# 适用于 Ubuntu 22.04 / CentOS 8

set -e  # 遇到错误立即退出

echo "=========================================="
echo "逮JOB 一键部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此脚本${NC}"
    echo "使用命令: sudo bash deploy.sh"
    exit 1
fi

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}无法检测操作系统${NC}"
    exit 1
fi

echo -e "${GREEN}检测到操作系统: $OS${NC}"

# 1. 安装 Docker
echo -e "\n${YELLOW}[1/8] 检查并安装 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "正在安装 Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker 安装完成${NC}"
else
    echo -e "${GREEN}Docker 已安装${NC}"
fi

# 2. 安装 Docker Compose
echo -e "\n${YELLOW}[2/8] 检查并安装 Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo "正在安装 Docker Compose..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt update
        apt install -y docker-compose
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y docker-compose
    fi
    echo -e "${GREEN}Docker Compose 安装完成${NC}"
else
    echo -e "${GREEN}Docker Compose 已安装${NC}"
fi

# 3. 安装 Git
echo -e "\n${YELLOW}[3/8] 检查并安装 Git...${NC}"
if ! command -v git &> /dev/null; then
    echo "正在安装 Git..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt install -y git
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y git
    fi
    echo -e "${GREEN}Git 安装完成${NC}"
else
    echo -e "${GREEN}Git 已安装${NC}"
fi

# 4. 克隆或更新项目
echo -e "\n${YELLOW}[4/8] 获取项目代码...${NC}"
PROJECT_DIR="/opt/yesjob"

if [ -d "$PROJECT_DIR/.git" ]; then
    echo "项目已存在，正在更新..."
    cd $PROJECT_DIR
    git pull
else
    echo "正在克隆项目..."
    mkdir -p /opt
    cd /opt
    git clone https://github.com/yohi-pixel/daijob.git yesjob
    cd yesjob
fi

# 5. 配置环境变量
echo -e "\n${YELLOW}[5/8] 配置环境变量...${NC}"
if [ ! -f .env ]; then
    echo "创建 .env 文件..."
    cp .env.example .env

    # 生成随机密钥
    SECRET_KEY=$(openssl rand -hex 32)
    sed -i "s/your-secret-key-here/$SECRET_KEY/" .env

    # 生成随机邀请码
    INVITE_CODE=$(openssl rand -hex 8)
    sed -i "s/AI_INVITE_CODE=/AI_INVITE_CODE=$INVITE_CODE/" .env

    echo -e "${GREEN}.env 文件已创建${NC}"
    echo -e "${YELLOW}重要信息：${NC}"
    echo -e "AI 邀请码: ${GREEN}$INVITE_CODE${NC}"
    echo -e "请妥善保存此邀请码，用户首次使用 AI 功能时需要输入"
    echo ""
    echo -e "${YELLOW}请编辑 .env 文件，配置以下必要信息：${NC}"
    echo "1. DEEPSEEK_API_KEY 或 QWEN_API_KEY (至少配置一个)"
    echo "2. 如需使用岗位推荐功能，配置 EMBEDDING_MODEL"
    echo ""
    read -p "是否现在编辑 .env 文件？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-vim} .env
    fi
else
    echo -e "${GREEN}.env 文件已存在，跳过创建${NC}"
fi

# 6. 创建必要的目录
echo -e "\n${YELLOW}[6/8] 创建必要的目录...${NC}"
mkdir -p data models daijob.site_nginx
echo -e "${GREEN}目录创建完成${NC}"

# 7. 配置防火墙
echo -e "\n${YELLOW}[7/8] 配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    echo "配置 UFW 防火墙..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}防火墙配置完成${NC}"
elif command -v firewall-cmd &> /dev/null; then
    echo "配置 firewalld 防火墙..."
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo -e "${GREEN}防火墙配置完成${NC}"
else
    echo -e "${YELLOW}未检测到防火墙，请手动配置开放 80、443 端口${NC}"
fi

# 8. 启动服务
echo -e "\n${YELLOW}[8/8] 启动服务...${NC}"
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo -e "\n${YELLOW}检查服务状态...${NC}"
docker-compose ps

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo -e "=========================================="
echo -e "访问地址: ${GREEN}http://$SERVER_IP${NC}"
echo -e "AI 邀请码: ${GREEN}$(grep AI_INVITE_CODE .env | cut -d'=' -f2)${NC}"
echo ""
echo -e "${YELLOW}后续步骤：${NC}"
echo "1. 编辑 .env 文件，配置 AI API 密钥"
echo "2. 如需 HTTPS，配置 SSL 证书到 daijob.site_nginx/ 目录"
echo "3. 重启服务: docker-compose restart"
echo ""
echo -e "${YELLOW}常用命令：${NC}"
echo "查看日志: docker-compose logs -f"
echo "重启服务: docker-compose restart"
echo "停止服务: docker-compose down"
echo "更新代码: bash update.sh"
echo ""
echo -e "${YELLOW}文档：${NC}"
echo "开发指南: docs/development-guide.md"
echo "部署指南: docs/deployment-tencent-cloud.md"
echo "=========================================="
