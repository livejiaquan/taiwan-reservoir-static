# 圖示與品牌標記

## 品牌標記

`assets/brand/mark.svg`（本資料夾的 `mark.svg` 是副本）：

- 64×64 的圓角方形，圓角 14.08（邊長的 22%），實心藍 `#2B79B0`（HSL 205°、61%、43%），沒有邊框、陰影、漸層。
- 中央放 Lucide `waves`，白色，佔邊長 58%（37.12px），筆畫 2。
- 頁首用 32px，旁邊是字標「台灣水庫水情」16px／600、字距 -0.01em，副標「經濟部水利署開放資料」12px／500、次要文字色，標記與字標間距 10px。
- 同一個 SVG 也是 `assets/favicon.svg`；`assets/apple-touch-icon.png`（180px）與 `assets/og-image.png`（1200×630，頁首含標記）都從這個 SVG 輸出。
- 深色模式下標記顏色不變。

## UI 圖示：全部改用 Lucide

來源是 `lucide-static` 1.61.0（ISC 授權，`assets/icons/LICENSE`）。原始檔放在 `assets/icons/`，內嵌成 `index.html` 開頭的 `<symbol>` sprite，不在執行時載入 CDN。

繪製參數統一為：24px 格、`stroke-width: 1.75`、`stroke-linecap: round`、`stroke-linejoin: round`、`fill: none`、`currentColor`。

| 用途 | 位置 | Lucide | 尺寸 | 取代的手繪 SVG |
|------|------|--------|------|---------------|
| 品牌標記 | 頁首、favicon、apple-touch-icon | `waves` | 32（標記內 58%） | 手繪「水尺＋水面」`i-gauge`（頁首自第五輪起已未使用，本輪刪除） |
| 重新整理 | 頁首按鈕 | `refresh-cw` | 20 | 手繪單箭頭圓弧 `i-refresh` |
| 切換深色 | 頁首按鈕（淺色時） | `moon` | 20 | 手繪月亮 `i-moon` |
| 切換淺色 | 頁首按鈕（深色時） | `sun` | 20 | 手繪太陽 `i-sun` |
| 展開／收合 | 清單每一列右側 | `chevron-down`（展開時旋轉 180°） | 16 | 手繪折線 `i-chevron` |
| 資料無法驗證 | 錯誤提示框標題旁 | `triangle-alert` | 24 | 手繪三角驚嘆號 `i-alert` |
| 開新視窗 | 「前往水利署水庫水情」按鈕 | `external-link` | 20 | 手繪箭頭方框 `i-external` |

尺寸只用三種：按鈕內 20、標題 24、表格與標籤 16。

站內沒有 emoji 圖示，也沒有混用其他圖示集。迷你趨勢線、24 小時走勢圖、水尺牆都是資料圖表，不屬於 icon。

## 移除的 GitHub 露出

- 頁尾「原始碼」連結（指向 repo）刪除，版權行改成「© 2026 Lim Jia Quan」，不加連結。
- `og:url`、`og:image` 使用站點網址（GitHub Pages 網域），不指向 repo。
- 網站產物的 grep 結果見 `github-grep.txt`：唯一一筆是 Barlow 字型 OFL 授權檔內的作者網址，屬於第三方授權註解。
