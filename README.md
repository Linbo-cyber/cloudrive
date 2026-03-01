# ClouDrive

基于 Cloudflare Pages + R2 的轻量文件管理系统。

## 功能

- 文件上传、下载、预览、删除、重命名、移动、复制
- 文件夹创建与管理
- 列表/网格双视图，文件搜索
- 管理员后台：用户管理、权限控制、访客开关
- 首次使用创建管理员，之后登录使用
- 访客模式（默认开启）：无需登录即可预览和下载
- JWT 认证，细粒度权限控制
- 图片/视频/音频/PDF/代码文件在线预览
- 拖拽上传，上传进度显示
- 响应式设计，移动端友好

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS v4
- UI：Coss UI 组件（@base-ui/react + radix-ui）
- 后端：Hono（Cloudflare Pages Functions）
- 存储：Cloudflare R2（文件）+ KV（用户数据）
- 认证：JWT（jose）

## 部署

### 1. 创建 Cloudflare 资源

```bash
# 创建 R2 bucket
wrangler r2 bucket create cloudrive

# 创建 KV namespace
wrangler kv namespace create KV
```

将 KV namespace id 填入 `wrangler.toml`。

### 2. 设置 JWT 密钥（可选）

```bash
wrangler pages secret put JWT_SECRET
```

不设置则使用默认密钥（仅开发用，生产环境务必设置）。

### 3. 部署

```bash
npm install
npm run deploy
```

### 4. 首次使用

访问部署后的 URL，会自动跳转到初始化页面，创建管理员账户即可开始使用。

## 本地开发

```bash
npm install
npm run dev      # 前端开发服务器
npm run preview  # 完整预览（含 Functions）
```

## 权限说明

| 权限 | 说明 |
|------|------|
| upload | 上传文件 |
| download | 下载文件 |
| preview | 预览文件 |
| delete | 删除文件/文件夹 |
| createFolder | 创建文件夹 |
| move | 移动文件/文件夹 |
| copy | 复制文件 |
| rename | 重命名文件/文件夹 |

管理员拥有全部权限。访客仅有预览和下载权限。
