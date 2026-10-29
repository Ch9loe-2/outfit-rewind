# HANDOFF — outfit-rewind

> 给接手的工程 agent（Codex）看的交接文档。读完这一份就能上手，不需要翻聊天记录。
> 生成时间：2026-10-29 ｜ 版本 `0.9.2` ｜ 仓库 https://github.com/Ch9loe-2/outfit-rewind

---

## 0. 30 秒速览

**这是什么**：一个纯前端 PWA。读今天天气 → 给一句穿衣建议 → 从用户手机相册里找出「天气和今天相似」的历史日子 → 看那天穿了什么。

**技术栈**：Vite 6 + React 19 + TypeScript + Dexie(IndexedDB) + exifr + heic2any。无后端、无账号、无数据库服务器。

**数据在哪**：全部在浏览器 IndexedDB（库名 `outfit-rewind`）。照片原图**从不入库、从不上传**，只存元数据 + 200px 缩略图。

**线上**：<https://ch9loe-2.github.io/outfit-rewind/>（GitHub Pages / `gh-pages` 分支）

**常用命令**

```bash
pnpm install
pnpm dev        # 本地开发
pnpm test       # vitest，23 个用例
pnpm build      # tsc -b && vite build && node scripts/build-sw.mjs
```

**当前规模**：~4400 行 TS/TSX；6 个测试文件；主包 390KB（gzip 127KB）。

---

## 1. 产品定义

目标用户只有一个：**自己**（作者本人）。当前不是商业产品，不追日活。

核心命题一句话：**「这样的天气不知道怎么穿？看看你在相似天气里穿了什么。」**

三条主动不做的边界（别顺手加回来）：

| 不做 | 原因 | 代价 |
|---|---|---|
| 衣橱单品入库（逐件拍照打标） | 录入成本是这类产品最大的流失点 | 答不了「这件多久没穿了」 |
| AI 生成文案 | 模板零成本、零延迟、可离线、可单测 | 文案有模板味 |
| 服务端 | 零运维、照片不出设备 | 换设备要手动备份，无跨设备同步 |

---

## 2. 代码地图

```
src/
  main.tsx              入口：挂载 React、注册 SW、跑旧标注迁移
  App.tsx               路由（HashRouter）+ ErrorBoundary；Settings/Import/Day 三个路由 lazy
  pages/
    Today.tsx           首页：定位 → 天气 → 穿衣建议 → 那年今天 Top3
    Import.tsx          导入：选文件夹/照片 → 进度 → 汇总 + 自动补天气
    Rewind.tsx          回忆：相似度/时间轴双视图、筛选、收藏、列表内 👍👎
    Day.tsx             那天：照片、天气对比、权重分解、收藏、标注、修补
    Settings.tsx        位置/时间段城市/体感偏好/历史起点/本机数据/备份/导出标注
  components/
    CitySearch.tsx      城市搜索（本地 353 城优先，远程 geocoding 补充）
    ErrorBoundary.tsx   单页崩溃兜底
    Metric.tsx / OutfitCard.tsx / TabBar.tsx
  lib/
    db.ts               Dexie schema（v1→v4）、表类型、清空/统计
    types.ts            Settings / Place / Period / DailyWeather 等
    settings.tsx        SettingsContext + localStorage 持久化（key: outfit-rewind:settings:v1）
    dates.ts            日期键、凌晨归属、月中位数
    photo.ts            EXIF 解析（exifr 动态导入）、缩略图（含 HEIC 兜底）
    importer.ts         导入编排 + 穿搭日聚合 + 邻近坐标推断
    archive.ts          历史天气按「位置×年」批量拉取与缓存
    weather.ts          实时/今日预报（Open-Meteo）、城市搜索、风力等级
    places.ts           地点解析优先级
    matches.ts          「穿搭日 × 天气」对齐 + 相似度计算（首页/回忆页共用）
    similarity.ts       六维距离与分数
    outfit.ts           穿衣规则（9 档 + 5 条叠加）
    votes.ts            标注读写（按 date+baseline）、CSV 导出
    backup.ts           备份 zip 导出/导入（含缩略图、设置、标注）
    zip.ts              自研 store-only zip 读写（无依赖）
    edit.ts             改日期 / 删一天
    location.ts         定位（两段式：粗略→高精度）
    lastWeather.ts      最近天气缓存（daily + 整包），离线降级用
    useThumb.ts         缩略图 objectURL hook
scripts/
  build-sw.mjs          构建后生成 sw.js（预缓存 14 个静态文件，缓存名带内容哈希）
  deploy.sh             推 gh-pages
  deploy-cf.sh          推 Cloudflare Pages（备用，未启用）
  smoke.tsx             SSR 冒烟脚本（开发期用的，未纳入 CI）
```

---

## 3. 数据模型（Dexie，库名 `outfit-rewind`）

当前 `version(4)`。表与索引：

| 表 | 主键 | 索引 | 说明 |
|---|---|---|---|
| `photos` | `id`（文件 hash） | `dayKey`, `takenAt` | 每张照片的元数据，无原图 |
| `days` | `date`(YYYY-MM-DD) | `year`, `month`, `favorite` | **穿搭日**，核心查询单位 |
| `weather` | `key`(`locKey:date`) | `locYear` | 历史天气缓存，按年整批写入 |
| `thumbs` | `id` | — | 200px webp Blob |
| `meta` | `k` | — | 预留，目前基本没写 |
| `feedback` | `date` | `vote` | **历史遗留**，只用于启动时迁移 |
| `votes` | `id`(`date|baseline`) | `date`, `baseline` | 标注，见 §6.3 |

关键字段：

```ts
PhotoRow  { id, dayKey, takenAt, takenAtSource:'exif'|'mtime', lat?, lon?, geoSource:'exif'|'none', width, height, mime, bytes }
DayRow    { date, year, month, lat?, lon?, photoIds[], heroPhotoId, photoCount, favorite?, geoSource?:'exif'|'imputed'|'none' }
WeatherRow{ key, locKey, locYear, date, tMax,tMin, feelsMax,feelsMin, precipSum, windMax, humidityMean|null, uvMax|null, weatherCode }
VoteRow   { id, date, baseline, vote:1|-1, score, deltas?:Record<string,number>, at }
```

**为什么 `days.date` 是主键**：所有展示都以「一天一套」为单位，按日期取最快。
**为什么 votes 要 `baseline`**：标注是「历史那天 vs 今天」这一对比较，换一天基准就变（见 §6.3）。

迁移（升级时不要破坏）：
- v2：`days.favorite` 索引
- v3：新增 `feedback`
- v4：新增 `votes`（`feedback` 保留，启动时由 `migrateLegacyVotes()` 搬到 `votes` 并清空）

---

## 4. 核心链路

### 4.1 导入（Import.tsx → importer.ts）

```
选择文件 → 过滤图片(mime/扩展名)
  → 逐张 readPhotoMeta(file)            // exifr 动态导入，只读文件头
  → id = hash(name|size|lastModified)   // 已存在则 skip（幂等）
  → dayKey = shiftLateNight(takenAt)    // 凌晨 0–4 点归前一天
  → makeThumb(file, 200)                // 失败且是 HEIC → 懒加载 heic2any 重试
  → 每 24 张一个事务 bulkPut(photos + thumbs)，每批让出主线程
  → 全部结束 rebuildDays()              // 全量重建穿搭日
  → ensureWeather(days, resolve)        // 按「位置×年」补历史天气
```

`rebuildDays()` 规则：
1. 按 `dayKey` 分组；
2. 坐标取当天所有照片的中位数；
3. hero 取面积最大（同面积取更早）；
4. **邻近推断**：没有坐标的日子，借用前后 3 天内最近的有坐标日，标记 `geoSource='imputed'`。

### 4.2 历史天气（archive.ts）

- 端点：`https://archive-api.open-meteo.com/v1/archive`
- 粒度：**按「locKey(经纬度各 1 位小数) + 年份」批量**，一年一次请求（不是一天一次）。当前年只取到昨天。
- 缓存命中判断：`weather.where('locYear').equals(...).count() > 0`。
- 字段：`temperature_2m_max/min, apparent_temperature_max/min, precipitation_sum, wind_speed_10m_max, weather_code, sunrise, sunset, relative_humidity_2m_mean`。
- **ERA5 没有 UV**，所以 `uvMax` 存 `null`，相似度自动跳过该维（实际是 5 维）。

### 4.3 匹配（matches.ts）

```
buildMatches(settings, today):
  days = db.days 全量
  place = placeOf(day)                    // 见 §5
  weather = db.weather.get(locKey(place)+':'+date)
  result = today ? match(toFeature(today), toFeature(weather)) : null
```

首页取 `result.score` 前 3；回忆页按分数或时间排序。

---

## 5. 地点解析优先级（places.ts，**改这里要特别小心**）

```
照片自带坐标（且 geoSource !== 'imputed'）
  > 时间段城市（periods，按日期区间）
  > 年份城市（yearPlaces）
  > 邻近推断坐标（imputed）
  > 常驻城市（settings.place）
```

- 时间段重叠时，**后添加的生效**（按 `createdAt` 取最大），添加时弹确认。
- 历史坑：展示与「补天气」必须用**同一个** `placeOf`，否则会出现「页面显示待补齐、其实从没去补」。已修，改动时别退回去。

---

## 6. 算法

### 6.1 相似度（similarity.ts）

6 维，各自先归一化再加权：

| 维度 | 权重 | 尺度 | 含义 |
|---|---|---|---|
| `feelsMean` 体感均温 | **0.50** | 8°C | 最重要 |
| `tempRange` 日温差 | 0.15 | 6°C | 决定要不要带外套 |
| `precip` 降水 | 0.20 | log1p → 5 | 0 和 30mm 是两种世界 |
| `windMax` 风速 | 0.08 | 20 km/h | |
| `humidity` 湿度 | 0.05 | 25% | |
| `uv` 紫外线 | 0.02 | 6 | 历史数据没有 |

```
D = Σ wᵢ · |xᵢ - yᵢ| / scaleᵢ     （缺失维度剔除并重归一化权重）
score = 100 · exp(-D / 0.8)
```

校准点（有单测锁定）：体感差 2°C≈90、5°C≈76、10°C≈58、16°C≈42、完全相同=100。

**为什么要降风/湿度权重**：`apparent_temperature`（体感）本身已经包含风速与水汽压，单列同权会重复计入同一阵风。这是当前权重的主要依据，但整体仍是**先验**，不是拟合结果（见 §9 待办）。

### 6.2 穿衣规则（outfit.ts）

体感均温 9 档（≥30/25/20/15/10/5/0/-5/极寒）给「内搭/中层/外套」；再叠加：
降水≥50% 加伞、风≥4 级外套升档、UV≥6 防晒、湿度≥85% 且闷热提示透气、昼夜温差≥10°C 提示叠穿。
文案是模板拼接，**不要接模型**（见 §1 边界）。

### 6.3 标注（votes.ts）

- 语义：**「这天和今天像不像」**，是一对比较。
- 主键 `date|baseline`，因此**昨天点的赞今天不生效**（这是刻意设计，曾经是 bug）。
- 每条记录投票时的 `deltas`（6 维归一化差值）与 `score`，用于离线拟合权重；**没有 deltas 的旧记录仍可导出，但信息量低**。
- 导出 CSV 只有 8 列纯数字，**不含日期/地点/照片**，可直接外发。

---

## 7. 外部依赖与网络契约

| 用途 | 端点 | 备注 |
|---|---|---|
| 今日天气 | `api.open-meteo.com/v1/forecast` | 免 key；CORS 允许 |
| 历史天气 | `archive-api.open-meteo.com/v1/archive` | 免 key；按年批量 |
| 城市搜索 | `geocoding-api.open-meteo.com/v1/search` | **可能被墙**，必须有本地兜底 |
| 城市坐标表 | 本地 `src/lib/cities.ts`（353 城，含拼音/首字母） | 生成自阿里 DataV 行政区划中心点 |

Open-Meteo 免费额度：600/分、5000/时、10000/天、30 万/月，**仅限非商业**。当前设计（按年批量）日常几乎不耗。

**失败降级链**：定位失败 → 用手动城市；天气失败 → 用 `lastWeather` 缓存的整包；城市搜索失败 → 本地表；整页断网 → SW 缓存 + 缓存天气。

---

## 8. 构建、部署、以及几个必须知道的坑

### 8.1 部署

```bash
./scripts/deploy.sh     # 构建 + 强推 gh-pages（GitHub Pages 线上）
```
产物是相对路径（`vite.config.ts` 里 `base: './'`），所以同一份 dist 既能挂 `/outfit-rewind/` 也能挂域名根目录。

Cloudflare Pages 备用：`wrangler.toml` + `scripts/deploy-cf.sh`（**未启用**，作者实测 github.io 秒开，暂不迁移）。

### 8.2 坑 1：Service Worker 缓存

- `pnpm build` 最后一步会跑 `scripts/build-sw.mjs`，生成 `dist/sw.js`（缓存名带内容哈希）。
- **绕开 `pnpm build` 直接 `vite build` 会导致 sw.js 不更新**，用户会一直看旧版。
- 调试时若改不动，先 `application → Service Workers → Unregister` 或强刷。

### 8.3 坑 2：用 GitHub API 推送会留下「坏树」

本机到 `github.com:443` 经常不通（多次连续失败），此时用 REST API 推提交。但 API 建出的 tree 对象**本地没有**，直接 `git commit` 会报 `bad tree object HEAD`。

修法（已用过两次）：用 `/git/trees/<sha>?recursive=1` 拿结构，逐级 `git mktree` 重建，校验根 sha 一致。**能 `git push` 就别用 API**。

### 8.4 坑 3：zip 是自研的

`src/lib/zip.ts` 只实现 **store（不压缩）**。读别人压过的 zip 会明确报错。别换库，除非要支持压缩包。

### 8.5 坑 4：备份导入后设置要刷新

照片/穿搭日立刻生效，但 `settings` 是从 localStorage 读的，需要刷新一次（已知，未修）。

---

## 9. 已知问题与待办（按价值排序）

1. **权重仍是先验，没有拟合**（最重要）
   机制已就绪：标注 → `导出标注` CSV（`vote,score,feelsMean,tempRange,precip,windMax,humidity,uv`）。
   待办：收到 30–50 条后做逻辑回归（带正则），对比现有权重，再决定是否替换。**50 条只能定方向，别过度解读。**
2. **没有 CI**：`pnpm test` 只能本地跑（推送用的 token 缺 `workflow` 权限，加不了 Actions）。
3. **备份导入后需刷新**（§8.5），加个提示或自动 reload 即可。
4. **桌面端仍是 520px 手机版式**，宽屏留白大。
5. **ERA5 与预报的系统偏差**未校准（可拿最近 30 天两种数据对齐估偏移）。
6. **性能未在真实规模验证**：作者只有 ~110 张照片（约 90 个穿搭日），列表无虚拟滚动、缩略图无 LRU。真到几千张再优化。
7. **天气备源**未接（和风等国内源都要 key，key 放前端等于公开；且目前没遇到天气接口不可用）。

---

## 10. 给接手者的建议

**先读这 5 个文件**（按顺序）：`db.ts` → `places.ts` → `matches.ts` → `similarity.ts` → `importer.ts`。其余都好懂。

**改动前先跑**：`pnpm test`（23 个用例锁住了相似度校准点、穿衣规则、凌晨归属、城市搜索、zip 往返、CSV 格式）。**不要改这些测试的期望值来让代码通过**——那几个数字是刻意的产品决策。

**不要引入**：状态管理库、组件库、i18n 框架、SSR、后端。这个体量加了就是负债。

**改 UI 后至少验证三件事**：390px 无横向溢出；`#/rewind` 与 `#/day/:date` 能正常进出；断网重载还能出页面（SW 生效）。

**隐私底线**：照片原图永远不入库、不上传；除「坐标 + 年份」外不发任何用户数据给第三方。

---

## 11. 验收清单（发版前）

```
[ ] pnpm test 全绿
[ ] pnpm build 成功，输出里有「sw.js 已生成：N 个文件，版本 xxxx」
[ ] 首页能出天气；拒绝定位时回退手动城市并给出提示
[ ] 导入 20 张照片 → 能出穿搭日，重复导入跳过数为 0 新增
[ ] 回忆页：相似度/时间轴切换、筛选、👍/👎（今天标完刷新仍亮）
[ ] 那天页：天气对比、权重分解、收藏、改日期、删除
[ ] 设置：导出备份 / 导入备份 / 导出标注
[ ] 断网重载首页 → 显示缓存天气并标注「离线」
[ ] 版本号、README 的功能清单与实际一致
```
