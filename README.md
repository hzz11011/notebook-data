# 网络记事本

一个功能丰富的在线记事本应用，支持多设备云端同步。

## ✨ 功能特点

- 📝 **富文本编辑**: 支持字体样式、颜色、图片、链接等
- 📁 **分类管理**: 灵活的笔记分类系统
- 🌙 **主题切换**: 支持浅色/深色主题
- ☁️ **云端同步**: 支持 GitHub、Gitee、WebDAV 多平台同步
- 📱 **响应式设计**: 完美适配桌面和移动设备
- 🔗 **分享功能**: 支持生成二维码和分享链接
- 💾 **自动保存**: 防止数据丢失
- 📤 **导入导出**: 支持数据备份和恢复

## 🚀 在线体验

访问地址：[https://your-username.gitee.io/notebook](https://your-username.gitee.io/notebook)

## 📦 部署说明

### Gitee Pages 部署

1. **Fork 或克隆此仓库**
2. **启用 Gitee Pages**：
   - 进入仓库设置
   - 找到 "Gitee Pages" 选项
   - 选择 "部署分支" 为 `master` 或 `main`
   - 点击 "启动" 按钮

3. **访问您的网站**：
   - 默认地址：`https://your-username.gitee.io/notebook`
   - 或绑定自定义域名

### 自定义域名绑定

1. **在 Gitee Pages 设置中添加自定义域名**
2. **在域名服务商处配置 CNAME 记录**：
   ```
   类型: CNAME
   主机记录: www (或 @)
   记录值: your-username.gitee.io
   ```

## 🔧 本地开发

1. **克隆仓库**：
   ```bash
   git clone https://gitee.com/your-username/notebook.git
   cd notebook
   ```

2. **直接打开**：
   - 用浏览器打开 `index.html` 文件
   - 或使用本地服务器：
   ```bash
   # 使用 Python
   python -m http.server 8000
   
   # 使用 Node.js
   npx serve .
   ```

## ☁️ 云端同步配置

### GitHub 同步
1. 创建 GitHub 仓库
2. 生成 Personal Access Token
3. 在应用中配置同步设置

### Gitee 同步
1. 创建 Gitee 仓库
2. 生成访问令牌
3. 在应用中配置同步设置

### WebDAV 同步
1. 配置 WebDAV 服务器
2. 在应用中输入服务器地址

## 📱 使用说明

1. **创建笔记**: 点击左侧 "新建笔记" 按钮
2. **分类管理**: 点击 "新建分类" 创建分类
3. **云端同步**: 点击工具栏云朵图标配置同步
4. **主题切换**: 点击月亮/太阳图标切换主题
5. **数据备份**: 点击下载按钮导出数据

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **存储**: LocalStorage + 云端同步
- **图标**: Font Awesome
- **二维码**: QRCode.js

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题，请通过以下方式联系：
- 提交 Issue
- 发送邮件

---

**注意**: 此应用数据存储在浏览器本地和您配置的云端服务中，请妥善保管您的访问令牌。