# مستندات فنی ماژول: Config

| مشخصه | مقدار |
|---|---|
| مسیر منبع | `BackEnd/app/config.py` |
| دسته | پیکربندی |
| مستندات مرتبط | [۰۱-Application Entrypoint](01-application-entrypoint.md) · [۰۴-Graph API Router](04-graph-api-router.md) · [۰۸-ETL](08-etl.md) · [۱۴-Import Data](14-import-data.md) |

## ۱. هدف (Purpose)

ماژول **Config** وظیفه نگهداری تنظیمات مرکزی Backend را بر عهده دارد. در وضعیت فعلی، تنها مقدار `DATABASE_URL` (Connection String اتصال به PostgreSQL) در این ماژول نگهداری می‌شود.

این ماژول به عنوان **منبع واحد حقیقت (Single Source of Truth)** برای پیکربندی اتصال دیتابیس عمل می‌کند تا سایر ماژول‌ها به جای تکرار مقدار، آن را از اینجا Import کنند.

## ۲. مسئولیت‌ها (Responsibilities)

| مسئولیت | توضیح |
|---|---|
| نگهداری پیکربندی دیتابیس | تعریف ثابت `DATABASE_URL` شامل کاربر، رمز، هاست و نام دیتابیس |
| تزریق پیکربندی | در دسترس قرار دادن این مقدار برای ماژول‌های مصرف‌کننده از طریق Import |
| جداسازی پیکربندی از منطق | جلوگیری از Hard-Code شدن تنظیمات داخل کدهای سرویس |

## ۳. فایل‌های مرتبط (Related Files)

| نقش | مسیر |
|---|---|
| **Main**: این فایل | `BackEnd/app/config.py` |
| مصرف در HealthCheck | `BackEnd/main.py` |
| مصرف در ETL | `BackEnd/app/services/ETL.py` |
| مصرف در روتر گراف | `BackEnd/app/api/routes/GraphData.py` |
| مصرف در ایمپورت داده | `BackEnd/import_data.py` |
| پیکربندی‌های محیط | `docker-compose.yml` (مقادیر Environment) |

## ۴. داده ورودی (Input Data)

| نوع ورودی | جزئیات |
|---|---|
| مقدار ثابت | String اتصال PostgreSQL با فرمت URI |
| مقادیر محیطی | مقادیر `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` از docker-compose (در حال حاضر به صورت دستی در `config.py` کپی شده) |

> نکته: در حال حاضر ورودی به صورت **Hard-code** در فایل تعریف شده و از Environment Variable خوانده نمی‌شود. مقدار آن با بقیه فایل‌ها (docker-compose) هماهنگ نیست (به بخش خطاها مراجعه کنید).

## ۵. منبع داده (Data Source)

| مورد | توضیح |
|---|---|
| منبع مقدار | پیکربندی سرویس دیتابیس در `docker-compose.yml` است (کاربر `mhgh0st` و پسورد مشخص‌شده در آنجا) |
| عدم تطابق نام دیتابیس | مقدار فعلی به نام دیتابیس پیش‌فرض `postgres` اشاره دارد؛ در حالی که کامپوز دیتابیس `graphdb` را ساخته است |
| کپی هاردکد جداگانه | `import_data.py:6` نیز یک `DATABASE_URL` مستقل (همان مقدار) را **به‌صورت هاردکد** تعریف می‌کند و از `app.config` import نمی‌کند — تغییر در `config.py` اتصال اسکریپت ایمپورت را به‌روز نمی‌کند |

## ۶. مراحل پردازش داده (Data Processing Steps)

این ماژول پردازشی ندارد؛ فقط یک مقدار ثابت است:

| مرحله | شرح |
|---|---|
| **۱. تعریف** | تعریف ثابت `DATABASE_URL` در سطح ماژول |
| **۲. Export** | قرار دادن این مقدار به صورت قابل Import برای سایر ماژول‌ها |
| **۳. مصرف** | استفاده از این مقدار در اتصال‌های `psycopg2`، `connectorx` و `adbc` |

## ۷. داده خروجی (Output Data)

| خروجی | توضیح |
|---|---|
| `DATABASE_URL` | رشته اتصال به PostgreSQL با الگوی `postgresql://user:password@host:port/dbname` |

## ۸. مصرف‌کنندگان خروجی (Where Outputs Are Consumed)

| مصرف‌کننده | نحوه استفاده |
|---|---|
| `main.py` | اتصال تستی در اندپوینت `/health` با `psycopg2` |
| `app/services/ETL.py` | خواندن Event Log با ConnectorX در تابع `get_lazyframe` |
| `app/api/routes/GraphData.py` | کوئری‌های مستقیم روی `dim_unit` (schema، filters، court-kinds) |
| `import_data.py` | نوشتن جداول و ساخت ایندکس‌ها هنگام ایمپورت |

## ۹. وابستگی‌ها (Dependencies)

| وابستگی | نوع |
|---|---|
| PostgreSQL | سرویس مقصد اتصال |
| هیچ کتابخانه خارجی | —— (فقط یک ثابت رشته‌ای) |

## ۱۰. خطاهای احتمالی (Error Scenarios)

| سناریو | رفتار فعلی |
|---|---|
| **عدم تطابق نام دیتابیس** | `docker-compose` دیتابیس `graphdb` را می‌سازد اما `config.py` به `postgres` متصل است؛ در صورت استفاده از دیتابیس `graphdb` اتصال ناموفق خواهد بود |
| **Exposition Credential** | رمز عبور به صورت Plain Text در `config.py` درج شده که در Source Control قابل مشاهده است |
| **تغییر شبکه (Host)** | هاردکد `db` باعث می‌شود خارج از Docker مقدار پیش‌فرض به درستی کار نکند |
| **نبود خواندن از Environment** | با تغییر مقادیر docker-compose، `config.py` تغییر نمی‌کند و اتصال ممکن است خطا بدهد |
| **تکرار مقدار در `import_data.py`** | اسکریپت ایمپورت اتصال را خودش هاردکد کرده و از این ماژول import نمی‌کند؛ در صورت تغییر `DATABASE_URL`، ایمپورت همچنان به مقدار قدیمی متصل می‌شود |

## ۱۱. نمودار جریان داده (Data Flow Diagram)

```mermaid
sequenceDiagram
    participant CFG as config.py
    participant ETL as ETL Service
    participant GR as GraphData Router
    participant M as main.py (/health)
    participant DB as PostgreSQL

    CFG-->>ETL: DATABASE_URL (import)
    ETL->>DB: ConnectorX read (بازخوانی Event Log)
    DB-->>ETL: داده Event Log

    CFG-->>GR: DATABASE_URL (import)
    GR->>DB: کوئری dim_unit (schema/filters/court-kinds)
    DB-->>GR: مقادیر ابعاد

    CFG-->>M: DATABASE_URL (import)
    M->>DB: psycopg2 SELECT 1
    DB-->>M: سالم (200)
```

## خلاصه

ماژول **Config** یک ماژول نگهدارنده پیکربندی است که `DATABASE_URL` را در یک نقطه متمرکز تعریف می‌کند تا همه ماژول‌های Backend (ETL، GraphData، HealthCheck و ایمپورت) از یک منبع واحد استفاده کنند. پردازش داده‌ای در آن انجام نمی‌شود؛ بلکه ورودی تنظیمات را به مصرف‌کنندگان توزیع می‌کند. این ماژول در وضعیت فعلی ورودی از Environment ندارد و باید برای استقرار واقعی به سمت خواندن از متغیرهای محیطی (Environment Variables) تکامل یابد.