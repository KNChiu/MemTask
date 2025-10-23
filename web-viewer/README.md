# MemTask Dashboard - FastAPI Version

基於 FastAPI + 原生 HTML/CSS/JavaScript 的 MemTask Web Dashboard，提供 Goals、Tasks 與 Memories 的視覺化管理介面。

## 特色

- ✅ **零編譯需求**：使用瀏覽器原生支援的 ES6 模組，無需 Webpack/Babel/npm build
- ✅ **完整功能**：保留原版所有功能（Goals、Tasks、Memories、Modal、Breadcrumb 導航）
- ✅ **自動輪詢**：每 5 秒自動更新資料，含 exponential backoff 錯誤處理
- ✅ **模組化架構**：6 個 JavaScript 模組 + 6 個 CSS 檔案，職責清晰
- ✅ **FastAPI 後端**：高效能 Python 非同步框架

## 系統需求

### 後端
- Python 3.8+
- [uv](https://github.com/astral-sh/uv) - 極速 Python 套件管理工具
  - 比 pip 快 10-100 倍
  - 自動管理虛擬環境
  - 統一的依賴解析

### 前端
- 現代瀏覽器（支援 ES6 模組）：
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+

## 安裝與啟動

### 快速啟動（推薦）

```bash
cd web-viewer-fastapi
chmod +x start.sh
./start.sh
```

`start.sh` 腳本會自動完成依賴安裝與伺服器啟動。

### 手動啟動

#### 1. 安裝 uv（如果尚未安裝）

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### 2. 同步依賴

```bash
cd web-viewer-fastapi
uv sync
```

這會自動：
- 建立虛擬環境
- 安裝 requirements.txt 中的所有依賴
- 鎖定版本以確保一致性

#### 3. 設定資料目錄（可選）

預設使用 `../mcp_data` 作為資料目錄，可透過環境變數修改：

```bash
export MCP_DATA_DIR=/path/to/your/mcp_data
```

資料目錄應包含以下結構：

```
mcp_data/
├── goals/          # Goals JSON 檔案
├── tasks/          # Tasks JSON 檔案
└── memories/       # Memories JSON 檔案
```

#### 4. 啟動伺服器

```bash
uv run python main.py
```

或指定埠號：

```bash
PORT=3000 uv run python main.py
```

#### 5. 開啟瀏覽器

訪問 `http://localhost:8000` 即可使用 Dashboard。

## API 端點

### 資料 API

- `GET /api/goals` - 取得所有 Goals
- `GET /api/tasks` - 取得所有 Tasks
- `GET /api/memories` - 取得所有 Memories
- `GET /api/health` - 健康檢查

### 文件

- `GET /docs` - FastAPI 自動產生的 API 文件（Swagger UI）
- `GET /redoc` - ReDoc 風格的 API 文件

## 專案結構

```
web-viewer-fastapi/
├── main.py                    # FastAPI 後端主程式
├── requirements.txt           # Python 依賴
├── README.md                  # 本說明文件
└── static/                    # 前端靜態資源
    ├── index.html            # 主頁面
    ├── scripts/              # JavaScript 模組
    │   ├── main.js           # 應用入口與全域狀態
    │   ├── data-loader.js    # 資料載入與自動輪詢
    │   ├── goal-renderer.js  # Goals 渲染邏輯
    │   ├── task-kanban.js    # Tasks 看板渲染
    │   ├── logger.js         # 日誌系統
    │   └── utils.js          # 工具函式
    └── styles/               # CSS 樣式
        ├── base.css          # 基礎樣式與 CSS 變數
        ├── layout.css        # 整體布局
        ├── components.css    # 通用元件樣式
        ├── goal-view.css     # Goals 視圖樣式
        ├── task-kanban.css   # 看板樣式
        └── memory-search.css # Memories 搜尋樣式
```

## 核心功能

### Goals 管理
- 卡片式 Goal 顯示
- 狀態與優先級標記
- 任務進度條
- 點擊查看詳情（Modal）

### Tasks 看板
- Kanban 四欄位佈局（Todo / In Progress / Completed / Cancelled）
- 任務優先級與狀態標記
- 依賴關係箭頭視覺化
- 標籤過濾
- 點擊查看詳情（Modal）

### Memories 瀏覽
- 全文搜尋
- 標籤過濾
- 時間戳顯示（相對時間）
- 點擊查看詳情（Modal）

### 過濾與搜尋
- 全域搜尋（快捷鍵：`/`）
- 狀態過濾
- 優先級過濾
- Goal 過濾
- 標籤過濾
- 一鍵清除所有過濾器

### 自動更新
- 每 5 秒自動輪詢 API
- 失敗時使用 exponential backoff（最長 60 秒）
- 手動刷新按鈕（快捷鍵：`Ctrl+R`）
- 最後更新時間顯示

### Modal 視窗
- Breadcrumb 導航（支援多層級）
- Goal → Task → Memory 跨模組導航
- ESC 快捷鍵關閉

## 開發說明

### JavaScript 模組化

本專案使用 **ES6 原生模組**，無需編譯工具：

```html
<!-- index.html -->
<script type="module" src="scripts/main.js"></script>
```

```javascript
// main.js
import { dataLoader } from './data-loader.js';
import { renderGoalCard } from './goal-renderer.js';
```

**重要**：
- 所有 `import` 路徑必須包含 `.js` 副檔名
- 使用相對路徑或絕對 URL
- 現代瀏覽器原生支援，無需 bundler

### CSS 組織

CSS 使用模組化分層結構：

1. **base.css** - CSS 變數、重置、字型
2. **layout.css** - 網格、容器、響應式布局
3. **components.css** - 按鈕、卡片、Modal 等通用元件
4. **goal-view.css** - Goals 特定樣式
5. **task-kanban.css** - 看板特定樣式
6. **memory-search.css** - Memories 特定樣式

### 新增功能

若要新增功能，建議遵循現有模組結構：

1. 在 `scripts/` 下建立新模組（如 `new-feature.js`）
2. 在 `styles/` 下建立對應樣式（如 `new-feature.css`）
3. 在 `index.html` 中引入新樣式
4. 在 `main.js` 中 `import` 並整合新模組

## 故障排除

### 頁面空白 / JavaScript 錯誤

1. 開啟瀏覽器開發者工具（F12）查看 Console
2. 確認是否有模組載入錯誤（通常是路徑問題）
3. 確認瀏覽器版本是否支援 ES6 模組

### API 連線失敗

1. 確認 FastAPI 伺服器是否正常運行
2. 檢查 `MCP_DATA_DIR` 環境變數是否正確
3. 訪問 `/api/health` 查看健康狀態

### CORS 錯誤

本專案已設定 CORS 允許所有來源，若仍有問題：

1. 確認是否透過 `http://localhost:8000` 訪問（不要使用 `file://`）
2. 檢查 `main.py` 中的 CORS 設定

## 技術棧

- **後端**：FastAPI (Python)
- **前端**：原生 HTML5 + CSS3 + ES6 JavaScript
- **架構**：ES6 模組 + 事件驅動
- **樣式**：CSS Grid + Flexbox + CSS Custom Properties
- **API**：RESTful JSON

## 授權

本專案為 MemTask Web Viewer 的 FastAPI 移植版本。

## 變更記錄

### v1.0.0 (2025-10-23)

- ✅ 完整移植 Express.js 版本到 FastAPI
- ✅ 保留所有原始功能
- ✅ 移除 Node.js 依賴，使用瀏覽器原生 ES6 模組
- ✅ 保留模組化架構（6 JS + 6 CSS）
- ✅ 完整的自動輪詢機制
