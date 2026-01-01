import polars as pl

# تنظیمات اتصال به دیتابیس (داخل شبکه داکر)
# فرمت: postgresql://user:password@service_name:port/db_name
# نکته مهم: هاست باید 'db' باشد نه 'localhost'
DATABASE_URL = "postgresql://mhgh0st:MHgh.982@db:5432/postgres"

def load_parquet_to_db():
    print("⏳ Reading Parquet file...")
    # 1. خواندن فایل پارکت با سرعت بالا
    try:
        df = pl.read_parquet("dataset.parquet")
        print(f"✅ Data loaded into memory. Shape: {df.shape}")

        df = df.rename({
            "case:concept:name" : "case_id",
            "concept:name" : "activity",
            "time:timestamp" : "timestamp"
        })

        print("✅ Dataframe columns renamed.")
    except FileNotFoundError:
        print("❌ Error: File 'data.parquet' not found inside /app directory.")
        return

    

    # 3. نوشتن در دیتابیس
    print("⏳ Writing to PostgreSQL (this might take a while for huge files)...")
    
    # دستور write_database در پولارز (نیاز به sqlalchemy و pyarrow دارد)
    df.write_database(
        table_name="test_1",  # نام جدولی که ساخته می‌شود
        connection=DATABASE_URL,
        if_table_exists="replace",   # اگر جدول بود جایگزین کن (یا "append" برای اضافه کردن)
        engine="adbc"
    )
    
    print("🎉 Success! Data imported to table 'test_1'.")

if __name__ == "__main__":
    load_parquet_to_db()