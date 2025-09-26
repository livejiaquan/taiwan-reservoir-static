# Git 推送到 GitHub 指南

以下是將您的專案推送到GitHub的步驟：

## 🚀 推送到GitHub的步驟

### 1. 初始化Git倉庫
```bash
cd taiwan-reservoir-static
git init
```

### 2. 配置Git用戶資訊
```bash
git config user.name "Jiaquan"
git config user.email "livejiaquan010313@gmail.com"
```

### 3. 添加所有文件
```bash
git add .
```

### 4. 提交初始版本
```bash
git commit -m "Initial commit: Taiwan Reservoir Monitoring System

- 台灣水庫即時監控系統
- 響應式設計，支援桌面/平板/手機
- 使用水利署開放API
- 現代化UI設計
- 完整的部署文檔"
```

### 5. 在GitHub建立新倉庫
1. 前往 https://github.com
2. 點擊右上角的 "+" → "New repository"
3. Repository name: `taiwan-reservoir-static`
4. Description: `🌊 台灣水庫即時監控系統 - Taiwan Reservoir Real-time Monitoring System`
5. 選擇 Public（讓其他人也能看到您的作品）
6. **不要**勾選 "Add a README file"（因為我們已經有了）
7. **不要**選擇 .gitignore 或 license（我們已經有了）
8. 點擊 "Create repository"

### 6. 連接本地和遠端倉庫
```bash
git remote add origin https://github.com/livejiaquan010313/taiwan-reservoir-static.git
git branch -M main
```

### 7. 推送到GitHub
```bash
git push -u origin main
```

### 8. 啟用GitHub Pages（自動部署）
推送完成後：
1. 在GitHub上進入您的倉庫頁面
2. 點擊 "Settings" 標籤
3. 向下滾動到 "Pages" 區段
4. 在 "Source" 下選擇 "Deploy from a branch"
5. 選擇 branch: `main`
6. 選擇資料夾: `/ (root)`
7. 點擊 "Save"
8. 等待幾分鐘後，您的網站就會在以下網址可用：
   `https://livejiaquan010313.github.io/taiwan-reservoir-static/`

## 🎯 完成後您將獲得

✅ **GitHub倉庫**: 展示您的程式設計能力  
✅ **線上Demo**: 讓其他人直接體驗您的作品  
✅ **開源貢獻**: 為台灣的開源社群貢獻一份力量  
✅ **作品集**: 在求職時展示您的前端技能  

## 📋 倉庫建議設定

### Repository描述
```
🌊 台灣水庫即時監控系統 - Taiwan Reservoir Real-time Monitoring System. 使用純前端技術開發，響應式設計，即時監控全台主要水庫蓄水情況。
```

### Topics標籤
建議添加以下標籤：
```
taiwan, reservoir, water, monitoring, javascript, html5, css3, responsive, chart-js, open-data
```

### README徽章（可選）
在README.md開頭添加：
```markdown
![GitHub Pages](https://img.shields.io/github/deployments/livejiaquan010313/taiwan-reservoir-static/github-pages?label=GitHub%20Pages)
![License](https://img.shields.io/github/license/livejiaquan010313/taiwan-reservoir-static)
![Language](https://img.shields.io/github/languages/top/livejiaquan010313/taiwan-reservoir-static)
```

## 🔄 日後更新

當您想要更新網站時：
```bash
# 修改文件後
git add .
git commit -m "描述您的更改"
git push
```

GitHub Pages會自動重新部署您的網站！

---

準備好推送了嗎？這將是一個很棒的開源專案！🎉