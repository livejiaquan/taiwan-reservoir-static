# 部署指南

本指南將協助你將台灣水庫即時監控系統部署到各種託管平台。

## 📦 部署前準備

確保你的專案包含以下文件：
```
taiwan-reservoir-static/
├── index.html
├── css/
├── js/
├── data/
├── LICENSE
└── README.md
```

## 🚀 部署選項

### 1. GitHub Pages（推薦 - 免費）

**優點：** 免費、與GitHub整合、自動SSL、自訂域名支援
**缺點：** 僅支援靜態網站

**步驟：**
1. 在GitHub建立新的repository
2. 上傳所有檔案到repository
3. 前往Settings > Pages
4. 選擇Source為"Deploy from a branch"
5. 選擇branch為`main`，資料夾為`/ (root)`
6. 點擊Save

**自訂域名（可選）：**
- 在Pages設定中輸入你的域名（例如：reservoir.yourdomain.com）
- 在你的DNS設定中新增CNAME記錄指向：`yourusername.github.io`

### 2. Netlify（推薦 - 功能豐富）

**優點：** 簡單部署、自動CI/CD、表單處理、無限頻寬
**缺點：** 免費版有限制

**方式一：拖拽部署**
1. 前往 https://netlify.com
2. 註冊並登入
3. 將專案資料夾直接拖拽到部署區域
4. 等待部署完成

**方式二：Git連接**
1. 連接你的GitHub repository
2. 自動偵測為靜態網站
3. 點擊Deploy

### 3. Vercel（現代化平台）

**優點：** 極快速度、全球CDN、自動優化
**缺點：** 免費版有使用限制

**步驟：**
1. 前往 https://vercel.com
2. 使用GitHub登入
3. Import專案repository
4. 自動部署

### 4. Firebase Hosting（Google）

**優點：** Google基礎設施、快速、SSL自動配置
**缺點：** 需要Firebase CLI設定

**步驟：**
1. 安裝Firebase CLI: `npm install -g firebase-tools`
2. 在專案目錄執行: `firebase login`
3. 初始化: `firebase init hosting`
4. 部署: `firebase deploy`

### 5. 自有伺服器部署

**適用於：** 有自己的VPS或伺服器

**Nginx設定範例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/taiwan-reservoir-static;
    index index.html;
    
    # 啟用gzip壓縮
    gzip on;
    gzip_types text/css application/javascript text/javascript application/json;
    
    # 快取設定
    location ~* \.(css|js|jpg|png|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML檔案不快取
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    
    # SPA路由支援（如果需要）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Apache設定範例（.htaccess）：**
```apache
# 啟用壓縮
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/json
</IfModule>

# 快取設定
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>

# 安全性標頭
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
Header always set X-XSS-Protection "1; mode=block"
```

## 🔧 部署後優化

### 1. 設定自訂域名
- 在DNS設定中新增A記錄或CNAME記錄
- 等待DNS傳播（通常需要幾分鐘到幾小時）

### 2. 啟用HTTPS
- 大部分現代託管平台都會自動啟用
- 自有伺服器可使用Let's Encrypt

### 3. 設定CDN（內容傳遞網路）
- Cloudflare（免費）
- AWS CloudFront
- Google Cloud CDN

### 4. 監控和分析
- Google Analytics
- Plausible Analytics（注重隱私）
- Simple Analytics

### 5. SEO優化
- 確認所有meta tags都已設定
- 建立sitemap.xml
- 設定robots.txt

## 📊 效能優化建議

1. **圖片優化**
   - 使用WebP格式
   - 設定適當的圖片大小

2. **程式碼壓縮**
   - CSS和JavaScript最小化
   - 移除未使用的程式碼

3. **快取策略**
   - 靜態資源設定長期快取
   - HTML設定較短快取時間

4. **監控效能**
   - Google PageSpeed Insights
   - WebPageTest
   - GTmetrix

## 🛠️ 故障排除

### 常見問題：

1. **CORS錯誤**
   - 確認API端點允許跨域請求
   - 檢查HTTPS/HTTP混用問題

2. **字體無法載入**
   - 確認Google Fonts正常連接
   - 檢查Content Security Policy設定

3. **JavaScript錯誤**
   - 檢查瀏覽器開發者工具的Console
   - 確認所有依賴都已正確載入

### 聯繫方式

如果在部署過程中遇到問題，歡迎：
- 📧 發送Email到：livejiaquan010313@gmail.com
- 🐙 在GitHub Repository提交Issue
- 💬 在專案討論區留言

---

## 📝 部署檢查清單

部署前請確認：
- [ ] 所有檔案都已上傳
- [ ] index.html可正常開啟
- [ ] CSS和JavaScript載入正常
- [ ] 水庫資料顯示正常
- [ ] 響應式設計在不同設備上工作正常
- [ ] 自訂域名（如有）已正確設定
- [ ] HTTPS已啟用
- [ ] 網站速度測試通過

祝你部署順利！🎉