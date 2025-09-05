# Netlify 部署指南

## 🚀 为什么选择 Netlify？

- ✅ **中国访问速度最快**
- ✅ **稳定性好，很少被墙**
- ✅ **免费额度充足**（100GB/月）
- ✅ **自动 HTTPS 证书**
- ✅ **支持自定义域名**
- ✅ **自动部署**

## 📋 部署步骤

### 方法一：拖拽部署（最简单）

1. **访问 Netlify**
   - 打开 https://netlify.com
   - 点击 "Sign up" 注册账号

2. **准备文件**
   - 将所有文件打包成 ZIP 文件
   - 包含：`index.html`, `styles.css`, `script.js`, `netlify.toml`

3. **拖拽上传**
   - 登录 Netlify 后，直接拖拽 ZIP 文件到页面
   - 等待自动部署完成

4. **获取访问地址**
   - 部署完成后会生成随机域名
   - 例如：`https://amazing-name-123456.netlify.app`

### 方法二：Git 仓库连接

1. **连接仓库**
   - 在 Netlify 中点击 "New site from Git"
   - 选择 "Deploy with GitHub" 或 "Deploy with GitLab"
   - 授权并选择您的仓库

2. **配置部署**
   - Build command: 留空（静态网站）
   - Publish directory: `/` 或留空
   - 点击 "Deploy site"

3. **自动部署**
   - 每次推送代码到仓库都会自动部署
   - 部署时间通常 1-2 分钟

## 🌐 自定义域名配置

### 1. 在 Netlify 中添加域名

1. 进入站点设置
2. 点击 "Domain management"
3. 点击 "Add custom domain"
4. 输入您的域名（如：`www.yourdomain.com`）

### 2. 配置 DNS 解析

在域名服务商处添加 CNAME 记录：

```
记录类型: CNAME
主机记录: www
记录值: your-site-name.netlify.app
TTL: 600
```

### 3. 启用 HTTPS

- Netlify 自动提供免费 SSL 证书
- 在域名设置中启用 "Force HTTPS"

## 🔧 高级配置

### 1. 环境变量

在 Netlify 设置中可以配置环境变量：
- 用于存储 API 密钥
- 配置不同环境的参数

### 2. 表单处理

Netlify 提供免费的表单处理功能：
- 自动处理表单提交
- 发送邮件通知
- 存储表单数据

### 3. 分支部署

- 主分支自动部署到生产环境
- 其他分支可以部署到预览环境
- 支持 Pull Request 预览

## 📱 性能优化

### 1. 自动优化

Netlify 自动提供：
- Gzip 压缩
- 图片优化
- CSS/JS 压缩
- CDN 加速

### 2. 缓存策略

通过 `netlify.toml` 配置：
```toml
[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

### 3. 预渲染

对于静态内容，Netlify 会自动预渲染，提升加载速度。

## 🛠️ 开发工作流

### 1. 本地开发

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 本地开发
netlify dev

# 部署到预览环境
netlify deploy

# 部署到生产环境
netlify deploy --prod
```

### 2. 持续集成

每次推送代码到 Git 仓库：
1. Netlify 自动检测变更
2. 自动构建和部署
3. 发送部署通知邮件

## 🔒 安全设置

### 1. 访问控制

- 可以设置密码保护
- 限制特定 IP 访问
- 设置访问白名单

### 2. 安全头部

通过 `netlify.toml` 配置安全头部：
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

## 📊 监控和分析

### 1. 访问统计

- 实时访问统计
- 页面浏览量
- 访客来源分析

### 2. 性能监控

- 页面加载时间
- 错误日志
- 部署历史

## 🆚 与其他平台对比

| 特性 | Netlify | Vercel | GitHub Pages |
|------|---------|--------|--------------|
| 中国访问速度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| 稳定性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| 免费额度 | 100GB/月 | 100GB/月 | 1GB/月 |
| 自定义域名 | ✅ | ✅ | ✅ |
| 自动部署 | ✅ | ✅ | ✅ |
| 表单处理 | ✅ | ❌ | ❌ |

## 💡 最佳实践

### 1. 文件组织

```
project/
├── index.html
├── styles.css
├── script.js
├── netlify.toml
├── _redirects
└── assets/
    ├── images/
    └── fonts/
```

### 2. 版本控制

- 使用 Git 进行版本控制
- 每次更新都提交到仓库
- 利用分支进行功能开发

### 3. 测试

- 部署前在本地测试
- 使用预览环境测试新功能
- 定期检查网站功能

## 🆘 常见问题

### Q: 部署失败怎么办？

A: 检查以下几点：
1. 文件路径是否正确
2. `netlify.toml` 配置是否有误
3. 查看部署日志中的错误信息

### Q: 自定义域名不生效？

A: 检查：
1. DNS 解析是否正确
2. 是否等待足够时间（最多 24 小时）
3. 域名是否已备案

### Q: 如何备份数据？

A: 建议：
1. 定期导出数据文件
2. 使用 Git 仓库备份代码
3. 配置云端同步功能

---

**总结**: Netlify 是中国用户部署静态网站的最佳选择，速度快、稳定性好、功能完善！
