# GitHub Pages 部署

此版本基于 Build 14，兼容用户主页根目录和普通仓库子目录。

## 自动发布

1. 将本文件所在目录的全部源码推送到 GitHub 仓库的 main 分支。
2. 仓库 Settings → Pages → Source 选择 GitHub Actions。
3. Actions 中运行 Build and deploy game to GitHub Pages（首次推送也会触发）。
4. 工作流完成后，github-pages environment 显示正式网址。

工作流从 GitHub Pages 获取 base_path，无需硬编码用户名或仓库名称。
模型、预览图、地面纹理、Service Worker 都通过 Vite BASE_URL 加载。
manifest 使用相对 start_url/scope/icon。缓存名称按子目录隔离。
现有游戏网址不会随本仓库上传而自动更新。

## Windows 本地编辑

安装 Node.js 22.12 或更新版本及 Git。用 GitHub Desktop 克隆时，将 Local path 选择为桌面目录；或在 PowerShell 中运行 git clone <实际仓库地址> <桌面目标目录>。

```powershell
npm.cmd ci
npm.cmd run dev
```

完整验证：

```powershell
npm.cmd test
node scripts/test-pages-builds.cjs
```

模拟仓库路径：

```powershell
npm.cmd run build -- --base /arena-wreckers/
npm.cmd run preview -- --base /arena-wreckers/
```

打开终端显示地址后面的 /arena-wreckers/。不能直接双击 dist/index.html。
GitHub 上需要完成的检查：Actions 部署成功；HTTPS 页面可加载；3D MODELS / READY；WebGL 战斗能开始；模型、纹理和离线缓存无 404。
本地路径测试不代表已完成 GitHub 公网验收。
