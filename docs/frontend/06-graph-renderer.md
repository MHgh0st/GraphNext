# مستندات فنی: رندر گراف (Graph Renderer)

| مشخصه | مقدار |
|---|---|
| مسیر منبع | `src/components/Graph.tsx`، `src/components/SankeyFlow.tsx`، `src/components/GraphLoadingState.tsx`، `src/components/GraphEmptyState.tsx`، `src/components/GraphDataReadyState.tsx` |
| دسته | کامپوننت Frontend |
| مستندات مرتبط | [۰۱-Layout & Providers (App Shell)](01-layout-providers-app-shell.md) · [۰۴-Zustand Stores](04-zustand-stores.md) · [۰۷-Graph UI Primitives](07-graph-ui-primitives.md) |

## ۱. هدف (Purpose)

ماژول **Graph Renderer** لایه نمایش گراف فرایند در فرانت‌اند است و شامل کامپوننت‌های زیر می‌شود:

| کامپوننت | فایل | نقش |
|---|---|---|
| `Graph` | `src/components/Graph.tsx` | رندر اصلی با **ReactFlow** — نودها، یال‌ها، Tooltipها، Ghost، خروجی تصویر |
| `SankeyFlow` | `src/components/SankeyFlow.tsx` | نمای گام‌به‌گام DAG در جریان‌ساز (Route Builder) |
| `GraphLoadingState` | `src/components/GraphLoadingState.tsx` | صفحه بارگذاری |
| `GraphEmptyState` | `src/components/GraphEmptyState.tsx` | صفحه «بدون داده» با پیام‌های متناسب Tab |
| `GraphDataReadyState` | `src/components/GraphDataReadyState.tsx` | صفحه «داده آماده است؛ اقدام کنید» |

این ماژول داده‌های Layout (از `useGraphStore`) را با استایل‌های داینامیک (شفافیت/فیلتر/رنگ/زوم) به صحنه گراف تبدیل می‌کند و تعاملات کاربر (کلیک نود/یال، پن، زوم، انتخاب مسیر) را به Store برمی‌گرداند.

## ۲. Props

### `Graph`

| Prop | نوع | توضیح |
|---|---|---|
| `className` | string (اختیاری) | کلاس استایل کانتینر |
| (از Provider) | `ReactFlowProvider` | `InnerGraph` به `useReactFlow` دسترسی دارد |

### `SankeyFlow`

| Prop | نوع | توضیح |
|---|---|---|
| `allVariants` | `Variant[]` | همه مسیرها (variants + outliers) برای محاسبه کاندیدها |
| `allNodes` | `Node[]` | نودهای گراف پایه |

### State Components

| کامپوننت | Props |
|---|---|
| `GraphLoadingState` | ندارد |
| `GraphEmptyState` / `GraphDataReadyState` | `activeTab: SidebarTab` — برای متن/رنگ/آیکون متناسب Tab |

## ۳. منبع Props (Props Source)

| منبع | توضیح |
|---|---|
| **App Shell (panel layout)** | `className` و `activeTab` و شرط رندر (انتخاب نود/مسیر یا RouteBuilder) |
| **useGraphStore** | `layoutedNodes/Edges`, `activeTooltipEdgeId`, `selectedEdgeId`, `isNodeCardVisible`, `isEdgeCardVisible`, `nodeTooltipTitle/Data`, `edgeTooltipTitle/Data`, `foundPaths`, `activePath`, `isHighlightModeActive`, `injectGhostElements`, `handleEdgeSelect`, `handleNodeClick` |
| **useAppStore** | `sidebarActiveTab`, `filters`, `selectedPathNodes/Edges/Index`, `variants`, `selectedNodeIds` (فیلتر) |
| **Constants/Utils** | `EDGE_TYPES` (StyledSmoothStepEdge), `NODE_TYPES` (CustomNode), `formatDuration`, `calculateEdgeOverride` |

## ۴. استیت داخلی (Internal State)

| State | پیش‌فرض | توضیح |
|---|---|---|
| `zoomLevel` | `1` | سطح زوم فعلی (نمایش/مخفی‌سازی برچسب‌ها) |
| `isExporting` | `false` | در حال خروجی گرفتن PNG |
| `containerRef` | — | کانتینر برای کلاس `is-interacting` و خروجی تصویر |

استیت‌های مشتق‌شده (`useMemo`):

| مقدار | فرمول |
|---|---|
| `selectedNodeId` | اولین نود `selected` در `layoutedNodes` |
| `nodesForRender` | فیلتر تیک‌خورده‌ها (+نودهای start/end)، کدگذاری شفافیت/گریس‌اسکیل بر اساس انتخاب/هایلایت |
| `edgesForRender` | محاسبه `displayLabel` (Override مسیر)، نمایش برچسب بر اساس زوم (>0.6)، استایل Ghost، رتبه‌بندی zIndex و sort |
| `edgeChartProps` | `{source, target, duration}` برای نمودار یال (فقط SearchCaseIds/Outliers) |

## ۵. هوک‌های استفاده‌شده (Hooks Used)

| هوک | کاربرد |
|---|---|
| `useState`, `useRef` | زوم، Export، کانتینر |
| `useMemo` ×۴ | selectedNodeId، نودهای رندر، یال‌های رندر، Props نمودار یال |
| `useCallback` | `onNodesChange` (applyNodeChanges)، move handlers، کلیک نود/یال، Export |
| `useEffect` ×۲ | `injectGhostElements(activePath, activeSideBar)`؛ دیباگ layoutedEdges |
| `useReactFlow` | `getNodes` برای Export |
| `memo` (Graph) | جلوگیری از رندر اضافه |

## ۶. فراخوانی‌های API (API Calls)

| فراخوانی | توضیح |
|---|---|
| **مستقیم: ندارد** | فقط consume از Storeها؛ API از طریق صفحات انجام می‌شود |
| **خروجی تصویر** | `toPng` از `html-to-image` روی `.react-flow__viewport` (بدون API سرور) |

## ۷. تبدیل داده (Data Transformation)

| تبدیل | شرح |
|---|---|
| **فیلتر نودها** | `filteredNodeIds` (تیک‌ها) + همیشه نودهای `start`/`end` و حاوی کلمه start/end |
| **opacity/gray** | انتخاب نود → بقیه 0.5 + grayscale؛ هایلایت مسیر → خارج از مسیر 0.1 |
| **برچسب یال** | `calculateEdgeOverride(edge, activePath)` → `displayLabel` (مدت زمان)؛ نمایش فقط وقتی `zoom > 0.6` و شفافیت بالا |
| **Ghost** | یال‌های Ghost: رنگ کهربایی `#f59e0b`، خط‌چین `5,5`، عرض 2.5 (یال Tooltip فعال `#FFC107`) |
| **مسیر جستجو (SearchCaseIds)** | یال‌های مسیر پرونده (`isSearchPathEdge`) از کم‌رنگ‌شدن ناشی از انتخاب نود مستثنی‌اند |
| **zIndex/Sort** | Tooltip فعال بالاترین؛ بعد Ghost؛ بعد مسیر انتخابی |
| **Override هوشمند** | در Highlight mode، override محاسبه‌شده Store به کار می‌رود (نه pre-baked) |
| **Export PNG** | `getNodesBounds` + `getViewportForBounds`؛ `pixelRatio` داینامیک (۲ معمولی، ۱ برای گراف بزرگ >4000px)؛ فیلتر عناصر (کنترل‌ها/پنل/Tooltip) |
| **SankeyFlow** | `computeCandidates`: **Sliding Window** روی `Variant_Path`ها → کاندیدهای گام بعدی با count و matchCount |

## ۸. خروجی رندر (Render Output)

### `Graph`

```
<ReactFlowProvider> ← Graph
  <InnerGraph className>
    ├─ Card نود (NodeTooltip)      ← وقتی isNodeCardVisible
    ├─ Card یال (EdgeTooltip)      ← وقتی isEdgeCardVisible (شامل chartProps)
    ├─ <ReactFlow nodes edges ...>
    │   ├─ Background (grid 20)
    │   ├─ Controls
    │   └─ Panel bottom-left: دکمه Camera (Export PNG)
    └─ (اگر isLoading → متن loadingMessage)
       (اگر layoutedNodes خالی → «هیچ داده‌ای وجود ندارد»)
```

حالت‌های رندر زودهنگام: `isLayoutLoading` → فقط پیام لودینگ؛ `layoutedNodes.length === 0` → پیام خالی.

### `SankeyFlow` (RouteBuilder)

نمودار مرحله‌ای افقی (X_OFFSET=500, Y_OFFSET=150) با انواع نود `start/selected/current/candidate`، کلیک روی candidate → `addNode` از `useRouteBuilderStore`؛ با `EdgeLabelRenderer` و دکمه‌های بازگشت/ریست.

### State Components

| کامپوننت | محتوا |
|---|---|
| `GraphLoadingState` | لودینگ (پیشرفت) |
| `GraphEmptyState` | بک‌گراند بلاب، ذرات، پیام راهنما مخصوص Tab |
| `GraphDataReadyState` | «داده آماده است» + پیشنهاد اقدام (Action) مخصوص Tab با رنگ accent |

## ۹. کامپوننت‌های استفاده‌کننده (Components Using It)

| مصرف‌کننده | نحوه استفاده |
|---|---|
| **App Shell (panel layout)** | رندر شرطی: `Graph` وقتی نود/مسیر انتخاب است؛ `SankeyFlow` در Tab جریان‌ساز؛ State components در حالت‌های دیگر |
| **graph/ui (زیرمجموعه)** | `CustomNode`, `StyledSmoothStepEdge`, `NodeTooltip`, `EdgeTooltip` — نودها/یال‌ها/کارت‌ها |
| **useGraphStore** | همه تعاملات از اینجا می‌آیند (برعکس) |

## ۱۰. نمودار جریان داده (Data Flow Diagram)

```mermaid
flowchart TD
    S["Stores (useGraphStore + useAppStore)"] -->|"layoutedNodes / layoutedEdges / فیلترها"| G["Graph.tsx (ReactFlow)"]
    G -->|"فیلتر نودها + شفافیت/grayscale"| RR["nodesForRender / edgesForRender"]
    RR -->|"nodes/edges"| RF["صحنه ReactFlow + Tooltips"]
    G -->|"کلیک نود/یال"|["handleNodeClick / handleEdgeSelect (به Store)"]
    S -->|"activePath"| GH["injectGhostElements (useEffect)"]
    GH -->|"یال‌های Ghost"| RR
    G -->|"toPng (html-to-image)"| PNG["Export PNG"]
    S -->|"Variant_Path"| SK["SankeyFlow (computeCandidates)"]
```

## خلاصه

ماژول **Graph Renderer** با ReactFlow صحنه گراف را می‌سازد: فیلتر تیک‌ها، شفافیت/فیلتر بر اساس انتخاب و هایلایت، برچسب زوم‌محور، Ghostهای کهربایی، Tooltipهای نود/یال (با نمودار duration) و خروجی PNG بهینه. `SankeyFlow` جریان‌ساز را با الگوریتم Sliding Window کاندیدها پیشنهاد می‌دهد و سه State Component وضعیت بارگذاری/خالی/آماده را با پیام‌های مخصوص هر Tab نشان می‌دهد. داده فقط از Storeها می‌آید؛ بدون API مستقیم.
