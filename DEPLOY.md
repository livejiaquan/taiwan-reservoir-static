# 部署

網站是純靜態檔案，沒有建置步驟，目前由 GitHub Pages 直接從 `main` 分支根目錄發布：
<https://livejiaquan.github.io/taiwan-reservoir-static/>

## GitHub Pages

1. repo 的 **Settings → Pages**，Source 選 **Deploy from a branch**。
2. Branch 選 `main`，資料夾選 `/ (root)`。
3. 推送到 `main` 後約 1 分鐘生效。

## 其他靜態主機

把整個 repo 根目錄上傳即可（Netlify、Cloudflare Pages、Vercel 都會自動辨識為靜態網站）。需要的檔案只有：

```
index.html
assets/
css/
js/
```

## 部署前檢查

```bash
npm test
npm start
```

開啟 <http://localhost:8080>，確認：

- 「蓄水量與資料時間」卡顯示「水利署最新觀測」，水尺牆有 20 根水柱。
- 在瀏覽器開發者工具把網路設為離線後重新整理，畫面應顯示「目前沒有網路連線」且不出現任何數字。

## 疑難排解

- **整頁顯示「目前無法確認官方資料」**：水利署 API 無法連線、回傳內容不完整（少於半數水庫），或觀測時間超過 48 小時。這是刻意的 fail-closed 設計，請先到[水利署水庫水情](https://fhy.wra.gov.tw/fhyv2/monitor/reservoir)確認官方是否正常。
- **CORS 錯誤**：本專案使用的兩個 `opendata.wra.gov.tw` 端點允許瀏覽器跨網域 GET；若改用其他端點需先確認。
- **舊資料殘留**：快取存在 localStorage 的 `reservoir_data_cache_v4`，有效 5 分鐘，讀取時也會重新驗證。
