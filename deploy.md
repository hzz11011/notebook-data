# Gitee Pages 部署指南

## 🚀 快速部署步骤

### 1. 创建 Gitee 仓库

1. 登录 [Gitee](https://gitee.com)
2. 点击右上角 "+" 号，选择 "新建仓库"
3. 填写仓库信息：
   - **仓库名称**: `notebook` (或您喜欢的名称)
   - **仓库描述**: `网络记事本应用`
   - **是否开源**: 选择 "开源" 或 "私有"
   - **初始化仓库**: 勾选 "使用 README 文件初始化这个仓库"

### 2. 上传代码

#### 方法一：网页上传
1. 在仓库页面点击 "上传文件"
2. 将所有文件拖拽到上传区域
3. 填写提交信息：`Initial commit: 添加记事本应用`
4. 点击 "提交"

#### 方法二：Git 命令行
```bash
# 克隆仓库
git clone https://gitee.com/your-username/notebook.git
cd notebook

# 复制所有文件到仓库目录
# (将 index.html, styles.css, script.js 等文件复制到这里)

# 添加文件
git add .

# 提交
git commit -m "Initial commit: 添加记事本应用"

# 推送
git push origin master
```

### 3. 启用 Gitee Pages

1. 进入仓库页面
2. 点击 "服务" → "Gitee Pages"
3. 配置部署选项：
   - **部署分支**: `master` 或 `main`
   - **部署目录**: `/` (根目录)
4. 点击 "启动" 按钮
5. 等待部署完成（通常需要几分钟）

### 4. 访问您的网站

部署完成后，您可以通过以下地址访问：
- **默认地址**: `https://your-username.gitee.io/notebook`
- **自定义域名**: 配置后可使用您的域名访问

## 🌐 自定义域名绑定

### 1. 在 Gitee Pages 中配置

1. 进入 "Gitee Pages" 设置页面
2. 在 "自定义域名" 输入框中填写您的域名
3. 点击 "保存" 按钮

### 2. 配置 DNS 解析

在您的域名服务商处添加 CNAME 记录：

#### 阿里云/腾讯云/其他服务商
```
记录类型: CNAME
主机记录: www
记录值: your-username.gitee.io
TTL: 600
```

#### 如果使用根域名 (@)
```
记录类型: CNAME
主机记录: @
记录值: your-username.gitee.io
TTL: 600
```

### 3. 等待生效

DNS 解析通常需要 10-30 分钟生效，请耐心等待。

## 🔧 高级配置

### 1. HTTPS 强制跳转

Gitee Pages 自动提供 HTTPS 支持，建议启用强制跳转：
1. 在 Gitee Pages 设置中勾选 "强制 HTTPS"
2. 确保所有访问都通过 HTTPS

### 2. 自定义 404 页面

创建 `404.html` 文件：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面未找到 - 网络记事本</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #667eea; }
        a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <h1>404 - 页面未找到</h1>
    <p>抱歉，您访问的页面不存在。</p>
    <a href="/">返回首页</a>
</body>
</html>
```

### 3. 性能优化

#### 启用 Gzip 压缩
Gitee Pages 自动启用 Gzip 压缩，无需额外配置。

#### 缓存策略
在 HTML 头部添加缓存控制：
```html
<meta http-equiv="Cache-Control" content="public, max-age=31536000">
```

## 📱 移动端优化

应用已内置响应式设计，在移动设备上会自动适配：
- 侧边栏自动收起
- 工具栏按钮适配触摸操作
- 字体大小自动调整

## 🔒 安全建议

### 1. 仓库权限
- 如果包含敏感信息，建议设置为私有仓库
- 定期检查仓库访问权限

### 2. 云端同步安全
- 使用强密码保护您的 Gitee 账号
- 定期更换访问令牌
- 不要在公共场所使用同步功能

## 🐛 常见问题

### Q: 部署后无法访问？
A: 检查以下几点：
1. 确认 Gitee Pages 已成功启动
2. 检查仓库是否为公开仓库
3. 等待几分钟让部署生效

### Q: 自定义域名不生效？
A: 检查以下几点：
1. DNS 解析是否正确配置
2. 是否等待足够时间让 DNS 生效
3. 域名是否已备案（国内域名）

### Q: 同步功能不工作？
A: 检查以下几点：
1. 网络连接是否正常
2. 访问令牌是否正确
3. 仓库权限是否足够

## 📞 技术支持

如遇到问题，可以通过以下方式获取帮助：
1. 查看 Gitee Pages 官方文档
2. 在仓库中提交 Issue
3. 联系技术支持

---

**提示**: 部署完成后，建议先在测试环境验证所有功能正常，然后再正式使用。
