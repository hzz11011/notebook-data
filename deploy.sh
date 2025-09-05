#!/bin/bash

# Gitee Pages 部署脚本
# 使用方法: ./deploy.sh "提交信息"

# 检查参数
if [ $# -eq 0 ]; then
    echo "使用方法: ./deploy.sh \"提交信息\""
    echo "例如: ./deploy.sh \"更新记事本功能\""
    exit 1
fi

COMMIT_MSG="$1"

echo "🚀 开始部署到 Gitee Pages..."

# 检查 Git 状态
if [ ! -d ".git" ]; then
    echo "❌ 当前目录不是 Git 仓库"
    echo "请先初始化 Git 仓库:"
    echo "  git init"
    echo "  git remote add origin https://gitee.com/your-username/notebook.git"
    exit 1
fi

# 添加所有文件
echo "📁 添加文件到 Git..."
git add .

# 检查是否有变更
if git diff --staged --quiet; then
    echo "ℹ️  没有检测到文件变更"
    exit 0
fi

# 提交变更
echo "💾 提交变更..."
git commit -m "$COMMIT_MSG"

# 推送到远程仓库
echo "☁️  推送到 Gitee..."
git push origin master

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo ""
    echo "📋 下一步操作："
    echo "1. 访问 Gitee 仓库页面"
    echo "2. 进入 '服务' → 'Gitee Pages'"
    echo "3. 点击 '启动' 按钮（如果尚未启动）"
    echo "4. 等待几分钟让部署生效"
    echo ""
    echo "🌐 访问地址："
    echo "   https://your-username.gitee.io/notebook"
    echo ""
    echo "💡 提示："
    echo "   - 首次部署可能需要等待 5-10 分钟"
    echo "   - 后续更新通常 1-2 分钟即可生效"
    echo "   - 可以配置自定义域名访问"
else
    echo "❌ 部署失败，请检查网络连接和仓库权限"
    exit 1
fi
