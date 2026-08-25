# فهرست ماژول‌های سامانه «فکر» (Fekr)

| مشخصه | مقدار |
|---|---|
| مسیر منبع | کل پروژه (`BackEnd/`، `FrontEnd/`) |
| دسته | سند کلی (Module Inventory) |
| مستندات مرتبط | [۰۰-تحلیل فنی](00-project-analysis.md) · [۰۱-معماری](01-architecture.md) · مستندات ماژول‌ها در `docs/frontend/` و `docs/backend/` |

## ۱. معرفی (Introduction)

این سند فهرست کاملی از ماژول‌های اصلی سامانه فکر است. هر ماژول شامل نام، مسیر، مسئولیت، فایل‌های اصلی، وابستگی‌ها و داده‌های پردازش‌شده معرفی شده است. هدف از این سند، آشنایی سریع توسعه‌دهندگان جدید با ساختار کد پروژه است.

## ۲. ماژول‌های Backend (Backend Modules)

### ۱. اپلیکیشن اصلی (Application Entrypoint)
- **مسیر منبع**: `BackEnd/main.py`
- **مسئولیت**: ساخت instance برنامه FastAPI، تنظیم CORS، mount کردن روترها و تعریف اندپوینت‌های `/` و `/health`
- **فایل‌های اصلی**: `main.py`
- **وابستگی‌ها**: FastAPI، psycopg2، روترهای GraphData، SearchCase، Stats و Auth، ماژول `app.config`
- **داده‌ها**: وضعیت سلامت سرویس (health status) و پیکربندی CORS

### ۲. پیکربندی (Config)
- **مسیر منبع**: `BackEnd/app/config.py`
- **مسئولیت**: نگهداری `DATABASE_URL` برای اتصال به PostgreSQL
- **فایل‌های اصلی**: `config.py`
- **وابستگی‌ها**: — (بدون وابستگی)
- **داده‌ها**: Connection String دیتابیس

### ۳. اسکیمای Pydantic (Schemas)
- **مسیر منبع**: `BackEnd/app/schemas.py`
- **مسئولیت**: تعریف مدل‌های ورودی/خروجی تحلیل Variant (GetVariantsRequest، VariantStats، GetVariantsResponse)
- **فایل‌های اصلی**: `schemas.py`
- **وابستگی‌ها**: Pydantic
- **داده‌ها**: پارامترهای تحلیل Variant و ساختار پاسخ آماری

### ۴. روتر گراف (Graph API Router)
- **مسیر منبع**: `BackEnd/app/api/routes/GraphData.py`
- **مسئولیت**: اندپوینت‌های `/api/graph/*` شامل schema، court-kinds، filters و اندپوینت اصلی `POST /data`؛ تفکیک unit_ids بر اساس فیلترهای ابعادی؛ سریال‌سازی پاسخ باینری (Arrow IPC → msgpack → zstd)
- **فایل‌های اصلی**: `GraphData.py`
- **وابستگی‌ها**: msgpack، zstandard، pyarrow، Polars، سرویس‌های ETL/variants/graph، `app.config`، دیتابیس (کوئری مستقیم روی `dim_unit`)
- **داده‌ها**: Event Log فیلترشده، Variantها، یال‌های DFG، متادیتای ابعادی، پاسخ باینری فشرده

### ۵. روتر جستجوی پرونده (SearchCase Router)
- **مسیر منبع**: `BackEnd/app/api/routes/SearchCase.py`
- **مسئولیت**: اندپوینت `GET /api/search` — یافتن یک پرونده (Case) و مقایسه آماری اختیاری با کل داده‌ها
- **فایل‌های اصلی**: `SearchCase.py`
- **وابستگی‌ها**: سرویس‌های ETL و searchCase
- **داده‌ها**: مسیر پرونده، Edge Durations و Position Stats

### ۶. روتر آمار (Stats Router)
- **مسیر منبع**: `BackEnd/app/api/routes/Stats.py`
- **مسئولیت**: اندپوینت‌های `GET /api/stats/global` و `GET /api/stats/edge`
- **فایل‌های اصلی**: `Stats.py`
- **وابستگی‌ها**: سرویس‌های ETL و stats
- **داده‌ها**: هیستوگرام‌های مدت‌زمان و تعداد مراحل

### ۷. روتر احراز هویت (Auth Router)
- **مسیر منبع**: `BackEnd/app/api/routes/Auth.py`
- **مسئولیت**: اندپوینت `POST /api/auth/log-login` — ثبت لاگ ورود کاربران (در حال حاضر Mock و ذخیره در حافظه)
- **فایل‌های اصلی**: `Auth.py`
- **وابستگی‌ها**: FastAPI BackgroundTasks
- **داده‌ها**: شماره تلفن، IP، User-Agent و Timestamp ورود

### ۸. سرویس ETL (ETL Service)
- **مسیر منبع**: `BackEnd/app/services/ETL.py`
- **مسئولیت**: بارگذاری داده از دیتابیس با موتور ConnectorX، استانداردسازی ستون‌ها، تبدیل Timestamp و غنی‌سازی رخدادها (Event_Rank، Case_Start_Time، Seconds_From_Start)
- **فایل‌های اصلی**: `ETL.py`
- **وابستگی‌ها**: Polars، ConnectorX، `app.config`
- **داده‌ها**: ردیف‌های Event Log (case_id، activity، timestamp، unit_id) به صورت `pl.LazyFrame`

### ۹. سرویس Variants (Variants Service)
- **مسیر منبع**: `BackEnd/app/services/variants.py`
- **مسئولیت**: ساخت Variant_Path و Frequency، محاسبه پوشش Pareto (cum_coverage)، آمارهای زمانی هر مرحله و استخراج نودهای Start/End (Heatmap)
- **فایل‌های اصلی**: `variants.py`
- **وابستگی‌ها**: Polars، NumPy، `utils.safe_calc_list_stats`
- **داده‌ها**: Variant_Path، Frequency، Percentage، Avg/Total/Min/Max/Median/Std Timings و True_Start/End_Count

### ۱۰. سرویس گراف (Graph Service)
- **مسیر منبع**: `BackEnd/app/services/graph.py`
- **مسئولیت**: تولید یال‌های DFG از Variantها، محاسبه آمار هر یال (Case_Count، Mean/Std/Median Duration، Branching Probability)، اعمال weight_metric و time_unit و فیلترهای تعداد/زمان
- **فایل‌های اصلی**: `graph.py`
- **وابستگی‌ها**: Polars، `utils.format_seconds_to_days_expr`
- **داده‌ها**: یال‌های گراف با آمار کامل و برچسب‌های نمایشی

### ۱۱. سرویس جستجوی پرونده (SearchCase Service)
- **مسیر منبع**: `BackEnd/app/services/searchCase.py`
- **مسئولیت**: استخراج مسیر یک case_id، محاسبه Edge Durations و Total Duration و مقایسه آماری (Percentile و مقایسه با میانگین)
- **فایل‌های اصلی**: `searchCase.py`
- **وابستگی‌ها**: Polars، bisect
- **داده‌ها**: مسیر پرونده، Edge Durations و آمار مقایسه با میانگین کل

### ۱۲. سرویس آمار (Stats Service)
- **مسیر منبع**: `BackEnd/app/services/stats.py`
- **مسئولیت**: ساخت هیستوگرام با NumPy برای توزیع مدت‌زمان پرونده‌ها، تعداد مراحل و مدت یک یال خاص
- **فایل‌های اصلی**: `stats.py`
- **وابستگی‌ها**: Polars، NumPy
- **داده‌ها**: توزیع مدت‌زمان، توزیع Steps و توزیع مدت یال

### ۱۳. سرویس Utilities (Utils Service)
- **مسیر منبع**: `BackEnd/app/services/utils.py`
- **مسئولیت**: توابع آماری لیست‌ها با لایه برداری Polars و Fallback به NumPy؛ فرمت‌بندی زمان به روز
- **فایل‌های اصلی**: `utils.py`
- **وابستگی‌ها**: Polars، NumPy
- **داده‌ها**: آمار List-of-Lists زمان‌ها (Mean/Min/Max/Median/Std)

### ۱۴. ایمپورت داده (Data Importer)
- **مسیر منبع**: `BackEnd/import_data.py`
- **مسئولیت**: خواندن فایل‌های CSV (dim_unit و process_case)، تبدیل تاریخ جلالی به میلادی، نوشتن در PostgreSQL (موتور ADBC) و ساخت ایندکس‌ها
- **فایل‌های اصلی**: `import_data.py`
- **وابستگی‌ها**: Polars، psycopg2
- **داده‌ها**: فایل‌های CSV، جداول PostgreSQL و ایندکس‌ها

### ۱۵. اسکریپت استارت‌آپ (Startup Script)
- **مسیر منبع**: `BackEnd/start.sh`
- **مسئولیت**: انتظار برای آماده‌شدن دیتابیس، اجرای `import_data.py` و سپس اجرای Uvicorn
- **فایل‌های اصلی**: `start.sh`
- **وابستگی‌ها**: Bash، Python، Uvicorn
- **داده‌ها**: — (فقط Orchestration)

## ۳. ماژول‌های Frontend (Frontend Modules)

### ۱۶. Layout و Providers (App Shell)
- **مسیر منبع**: `src/app/layout.tsx`, `src/app/Providers.tsx`, `src/app/(panel)/layout.tsx`
- **مسئولیت**: تنظیم RTL و فونت Vazir، Providers کتابخانه HeroUI، چیدمان سه‌ستونه (آیکون‌بار، پنل کناری و گراف) و انتخاب حالت نمایش گراف بر اساس تب فعال
- **فایل‌های اصلی**: `layout.tsx`, `Providers.tsx`
- **وابستگی‌ها**: HeroUI، Zustand، کامپوننت‌های Graph/Navbar/SideBar/SankeyFlow
- **داده‌ها**: تب فعال Sidebar، نودها و یال‌های گراف

### ۱۷. Middleware احراز هویت (Auth Proxy Middleware)
- **مسیر منبع**: `src/proxy.ts`
- **مسئولیت**: بررسی کوکی `auth_token` و هدایت کاربر به صفحه `/login` در صورت عدم ورود
- **فایل‌های اصلی**: `src/proxy.ts`
- **وابستگی‌ها**: Next.js Middleware
- **داده‌ها**: کوکی‌ها و مسیرهای درخواستی

### ۱۸. صفحه ورود (Login Module)
- **مسیر منبع**: `src/app/(auth)/login/`
- **مسئولیت**: فرم ورود با شماره موبایل و کد OTP (در حال حاضر Mock)، نمایش وضعیت سلامت سرویس‌ها
- **فایل‌های اصلی**: `page.tsx`
- **وابستگی‌ها**: HeroUI، framer-motion، lucide-react
- **داده‌ها**: شماره تلفن، کد OTP و وضعیت سلامت سیستم

### ۱۹. لایه State (Zustand Stores)
- **مسیر منبع**: `src/store/useGraphStore.ts`, `src/hooks/useAppStore.ts`, `src/store/useRouteBuilderStore.ts`
- **مسئولیت**: مدیریت داده گراف، فیلترها، تعاملات و جریان‌ساز؛ محاسبه ELK Layout، مدیریت Tooltipها، Pathfinding و Ghost Elements
- **فایل‌های اصلی**: `useGraphStore.ts`, `useAppStore.ts`, `useRouteBuilderStore.ts`
- **وابستگی‌ها**: Zustand، XYFlow، elkjs، colorPalettes، formatDuration
- **داده‌ها**: graphData، variants، outliers، نودها/یال‌ها، انتخاب‌ها، فیلترها، foundPaths و activePath

### ۲۰. لایه ارتباط با Backend (Fetcher)
- **مسیر منبع**: `src/utils/fetcher/`
- **مسئولیت**: ساخت URL و ارسال درخواست‌ها، Parse پاسخ باینری (zstd → msgpack → Arrow IPC) و مدیریت خطاها
- **فایل‌های اصلی**: `core.ts`, `parsers.ts`, `index.ts`, `api/graph.ts`, `api/search.ts`, `api/stats.ts`, `api/health.ts`
- **وابستگی‌ها**: fzstd، @msgpack/msgpack، apache-arrow، کامپوننت Toast
- **داده‌ها**: فیلترها، پاسخ باینری گراف، نتایج جستجو و هیستوگرام‌ها

### ۲۱. کامپوننت رندر گراف (Graph Renderer)
- **مسیر منبع**: `src/components/Graph.tsx`
- **مسئولیت**: رندر نودها و یال‌ها و مدیریت تعاملات (کلیک، انتخاب، Tooltip)
- **فایل‌های اصلی**: `Graph.tsx`
- **وابستگی‌ها**: XYFlow، useGraphStore، کامپوننت‌های `graph/ui`
- **داده‌ها**: layoutedNodes و layoutedEdges

### ۲۲. کامپوننت‌های UI گراف (Graph UI Primitives)
- **مسیر منبع**: `src/components/graph/ui/`
- **مسئولیت**: نود سفارشی، یال SmoothStep، Tooltip نود/یال و نمودارهای توزیع آماری
- **فایل‌های اصلی**: `CustomNode.tsx`, `StyledSmoothStepEdge.tsx`, `NodeTooltip.tsx`, `EdgeTooltip.tsx`, `CaseDistributionCharts.tsx`, `EdgeDurationChart.tsx`
- **وابستگی‌ها**: XYFlow، apexcharts، react-apexcharts
- **داده‌ها**: Tooltipهای آماری نودها/یال‌ها و هیستوگرام‌ها

### ۲۳. نوار بالای سامانه (Navbar)
- **مسیر منبع**: `src/components/Navbar.tsx`
- **مسئولیت**: فیلتر بازه زمانی شمسی، فیلتر درختی ابعاد (LEV1 تا LEV8)، فیلتر صلاحیت شعبه و دریافت Schema و Court Kinds
- **فایل‌های اصلی**: `Navbar.tsx`
- **وابستگی‌ها**: HeroUI، moment-jalaali، @internationalized/date، fetcher، useAppStore و useGraphStore
- **داده‌ها**: dimensionOptions، courtKinds، schema و فیلترهای انتخابی

### ۲۴. پنل فیلتر و پردازش (Dashboard Filter Form)
- **مسیر منبع**: `src/app/(panel)/page.tsx`
- **مسئولیت**: فرم فیلترها (تعداد پرونده، میانگین زمان، معیار وزن، واحد نمایش، درصد داده پرت و درخت فعالیت) و ارسال POST برای دریافت گراف
- **فایل‌های اصلی**: `page.tsx`
- **وابستگی‌ها**: HeroUI، ActivityTreeFilter، TimeFilterSection، fetcher
- **داده‌ها**: FilterTypes و داده گراف دریافتی

### ۲۵. فیلتر درختی فعالیت‌ها (Activity Tree Filter)
- **مسیر منبع**: `src/components/ActivityTreeFilter.tsx`
- **مسئولیت**: فیلتر درختی کلاینت‌ساید نودهای گراف بر اساس ساختار
- **فایل‌های اصلی**: `ActivityTreeFilter.tsx`
- **وابستگی‌ها**: useAppStore، useGraphStore
- **داده‌ها**: شناسه نودهای فیلترشده (Filtered Node IDs)

### ۲۶. جریان‌ساز هوشمند (Route Builder / Sankey)
- **مسیر منبع**: `src/components/SankeyFlow.tsx` و `src/app/(panel)/route-builder/page.tsx`
- **مسئولیت**: ساخت مسیر به صورت گام‌به‌گام (computeCandidates) بر اساس Variantها و نمایش آن به صورت DAG
- **فایل‌های اصلی**: `SankeyFlow.tsx`, `page.tsx`
- **وابستگی‌ها**: XYFlow، useRouteBuilderStore
- **داده‌ها**: selectedPath، کاندیداهای پیشنهادی و Match Counters

### ۲۷. مسیریابی (Pathfinder)
- **مسیر منبع**: `src/app/(panel)/routing/page.tsx` و `src/components/sideBarCards/PathList.tsx`
- **مسئولیت**: انتخاب مبدا و مقصد، استخراج مسیرها از Variantها، ادغام مسیرهای مشابه، محاسبه Duration و هایلایت مسیر
- **فایل‌های اصلی**: `routing/page.tsx`, `PathList.tsx`
- **وابستگی‌ها**: useGraphStore، HeroUI
- **داده‌ها**: foundPaths، processedPaths، مسیرهای ادغام‌شده و Durationها

### ۲۸. صفحات کمکی (Outliers / Search / Settings / Guide)
- **مسیر منبع**: `src/app/(panel)/outliers/`, `search-case-ids/`, `settings/`, `guide/`
- **مسئولیت**: تحلیل مسیرهای کم‌تکرار، جستجوی پرونده با شناسه، تغییر پالت رنگی و صفحه راهنما
- **فایل‌های اصلی**: `page.tsx` هر پوشه و فایل‌های `loading.tsx`
- **وابستگی‌ها**: fetcher، Zustand Stores، colorPalettes
- **داده‌ها**: outliers، نتایج Search API و پالت انتخاب‌شده

### ۲۹. تایپ‌ها و ثابت‌های دامنه (Domain Types & Constants)
- **مسیر منبع**: `src/types/types.ts`, `src/constants/colorPalettes.ts`, `src/constants/tabThemes.ts`
- **مسئولیت**: تعریف Interfaceهای دامنه و پالت‌های رنگی/تم تب‌ها
- **فایل‌های اصلی**: `types.ts`, `colorPalettes.ts`, `tabThemes.ts`
- **وابستگی‌ها**: — (فقط تعریف Type)
- **داده‌ها**: Schemaهای داده‌ای (FilterTypes، Variant، GraphData، Path و ...)

### ۳۰. توابع کمکی (Helper Utilities)
- **مسیر منبع**: `src/utils/formatDuration.ts`, `src/utils/hero.ts`, `src/utils/layout-worker.ts` (منسوخ)
- **مسئولیت**: فرمت‌بندی مدت‌زمان، توابع کمکی HeroUI و Worker قدیمی Layout
- **فایل‌های اصلی**: `formatDuration.ts`, `hero.ts`, `layout-worker.ts`
- **وابستگی‌ها**: — (بدون وابستگی)
- **داده‌ها**: مدت‌زمان‌ها (تبدیل Second به رشته نمایشی)

## ۴. خلاصه (Summary)

سامانه فکر از ۱۵ ماژول Backend و ۱۵ ماژول Frontend تشکیل شده است:

- **Backend**: تمرکز بر پردازش داده با Polars و ارائه پاسخ باینری فشرده (Arrow IPC + msgpack + zstd)
- **Frontend**: تمرکز بر نمایش گراف تعاملی با XYFlow/ELK و تحلیل مسیر سمت کلاینت
- **ماژول‌های اصلی**: ETL، Variants، Graph، fetcher/parsers، useGraphStore و کامپوننت Graph بیشترین نقش را در جریان داده اصلی دارند
