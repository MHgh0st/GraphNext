FROM python:3.10-slim

WORKDIR /app

# نصب وابستگی‌های سیستم (برای psycopg2 و محاسبات شاید لازم شود)
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# پورت پیش‌فرض FastAPI
EXPOSE 8000

# دستور اجرای برنامه با Uvicorn (سرور فوق سریع)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]