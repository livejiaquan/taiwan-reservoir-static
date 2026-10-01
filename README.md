# 台灣水庫觀測

以水利署開放資料查看水庫蓄水量、有效容量與來源時間的原生 HTML / CSS / JavaScript 網頁。本站目前對照 20 座水庫（北 5、中 7、南 8），尚未納入東部與離島；不是全台完整水情或官方限水判定。

## 閱讀順序

1. **時間與範圍**：水量觀測區間、成功擷取時間、涵蓋數量與缺席水庫分開顯示
2. **容量加權概況**：以蓄水量總和 ÷ 有效容量總和為主要數字，並列分子、分母、單位與涵蓋範圍
3. **地區探索**：依地區篩選，說明各區顯示數量；空區域、未涵蓋東部與整份快照失敗有不同文字
4. **逐庫記錄**：蓄水率、觀測水量、有效容量、水量觀測時間及容量資料時間
5. **來源與方法**：官方資料連結、計算方式、本站檢查門檻及判讀限制

「逐庫比較」可展開橫條圖與原生數值清單。圖表按需建立，Chart.js 載入失敗時仍可讀取數值並用鍵盤跳至水庫記錄。圖表／清單／低蓄水率提醒共用會切換地區並移動焦點的詳情跳轉。

## 資料契約

- 水量來自[水庫水情資料](https://data.gov.tw/dataset/45601)，有效容量來自[水庫每日營運狀況](https://data.gov.tw/dataset/41568)
- 以水庫代碼合併兩份資料，按真正時間選取最新有效記錄；空值與負值哨兵不會變成零蓄水
- 所有時間以台北 UTC+8 顯示；未附時區的來源時間按台北時間解析，容量資料時間未知時保留未知
- 每 5 分鐘嘗試擷取，與官方更新頻率不同；5 分鐘快取保留原始成功擷取時間
- 少於 10/20 座、觀測超過 48 小時或超前 1 小時時，整份快照不顯示；觀測超過 6 小時加註提醒
- 10–19 座為部分覆蓋，會列出未顯示水庫；缺資料不代表零水量
- 合計蓄水率以容量加權，不是百分比算術平均，也不是同時刻或全台總量
- 超過 100% 的數值如實保留；卡片的水量尺只限制繪圖長度，Chart.js 座標軸可延伸
- API／格式／驗證失敗時清除水情數值，不用示範資料替代；沒有可驗證歷史資料便不生成歷史圖
- 蓄水率區間只是分組，不能單獨判定乾旱、季節異常、限水或自來水停水

詳細來源與歷次抽查界線見 [DATA_CONTEXT.md](docs/DATA_CONTEXT.md)。

## 開發

不需要套件安裝、框架或打包流程。Node.js 18+ 可執行離線測試。靜態頁面可透過已允許的本機預覽流程開啟，例如：

```bash
python3 -m http.server 8080
```

再於支援且允許存取該伺服器的瀏覽器開啟 `http://localhost:8080`。若執行環境禁止 loopback 或本機檔案瀏覽，不應繞過限制；改在受支援的環境驗證。

```text
index.html                  語意結構、來源說明、原生 disclosure
css/main.css                色彩／排版 token、頁面配置、responsive／focus／motion
css/components.css          水量概況、逐庫記錄、提醒及空狀態
js/api.js                   官方來源、解析、驗證與快取
js/utils.js                 時區、加權計算、格式化、動作與事件工具
js/main.js                  狀態、render、篩選、焦點管理與擷取
js/charts.js                可選 Chart.js 圖表與事件清理
```

Chart.js、Noto Sans TC、Bootstrap Icons 由 CDN 提供；圖表失效有文字替代，字體有系統後備字型，主要按鈕有文字標籤。正式頁面不載入 `data/mock-data.js`。

## 驗證

```bash
find js data tests -type f -name '*.js' -print0 | xargs -0 -n 1 node --check
TZ=UTC node --test tests/*.test.js
TZ=America/Los_Angeles node --test tests/*.test.js
TZ=Asia/Taipei node --test tests/*.test.js
git diff --check
```

目前 56 項離線回歸涵蓋來源／時區／加權／覆蓋／快取／資料拒絕與 UI render 契約，並新增圖表失效替代、篩選後詳情跳轉、方向鍵、焦點保留、部分區域空狀態、載入畫面退出、長名稱轉義、reduced motion 及文字色彩 token 對比檢查。合成 fixture 不是目前水情。

`.github/workflows/development-checks.yml` 對 `codex/**` push 與 PR 使用 Node.js 24，在 UTC、洛杉磯、台北執行相同離線檢查。Workflow 僅具 `contents: read` 權限，不保留 checkout 憑證、不使用 secrets、不安裝專案套件、不上傳網站產物、不部署。

**Node 通過不代表畫面驗收通過。** 本批雲端瀏覽器受已知 loopback 限制，尚未驗證 320／390／768／1440px、200% 縮放、實際字型、螢幕閱讀器、官方 API 瀏覽器 CORS 或視覺品質；需在可用的受支援瀏覽器完成 [視覺與互動驗收清單](docs/UI_VALIDATION.md)。不宣稱已達獎項級視覺驗收。

## 授權

[MIT License](LICENSE)。本專案為獨立資訊整理，實際水情與供水措施請以水利署及供水單位公告為準。
