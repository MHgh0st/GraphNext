import polars as pl
import psycopg2  # اضافه کردن برای اتصال مستقیم و اجرای دستورات SQL
from datetime import datetime

# تنظیمات اتصال به دیتابیس (داخل شبکه داکر)
DATABASE_URL = "postgresql://mhgh0st:MHgh.982@db:5432/postgres"


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> tuple[int, int, int]:
    """Convert Jalali (Persian) date to Gregorian date."""
    jy -= 979
    jm -= 1
    jd -= 1

    j_day_no = 365 * jy + jy // 33 * 8 + ((jy % 33) + 3) // 4
    for i in range(jm):
        j_day_no += [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29][i]
    j_day_no += jd

    g_day_no = j_day_no + 79
    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097

    leap = True
    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1
        else:
            leap = False

    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461

    if g_day_no >= 366:
        leap = False
        g_day_no -= 366
        gy += g_day_no // 365
        g_day_no %= 365

    gregorian_months = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    while gm < 12 and g_day_no >= gregorian_months[gm]:
        g_day_no -= gregorian_months[gm]
        gm += 1

    gd = g_day_no + 1
    return gy, gm + 1, gd


def parse_jalali_timestamp(value: str) -> datetime:
    """Convert a Jalali datetime string to a Python Gregorian datetime."""
    if not value or not isinstance(value, str):
        raise ValueError("Invalid Jalali datetime string")

    date_part, time_part = value.split("-")
    jy, jm, jd = map(int, date_part.split("/"))
    hour, minute = map(int, time_part.split(":"))
    gy, gm, gd = jalali_to_gregorian(jy, jm, jd)
    return datetime(gy, gm, gd, hour, minute)


def load_parquet_to_db(file_path="dataset.parquet", column_names=None, table_name="test_1", delimiter=","):
    print("⏳ Reading CSV file...")
    try:
        df = pl.read_csv(file_path, separator=delimiter)
        print(f"✅ Data loaded into memory. Shape: {df.shape}")
        print(f"📋 Actual column names: {df.columns}")
        print(f"📋 First row:\n{df.head(1)}")

        # df = df.rename({
        #     "case:concept:name" : "case_id",
        #     "concept:name" : "activity",
        #     "time:timestamp" : "timestamp"
        # })
        if column_names:
            df = df.rename(column_names)
            print("✅ Dataframe columns renamed.")
        else:
            print("✅ No column rename mapping provided.")

        if table_name == "process_case" and "timestamp" in df.columns:
            print("⏳ Converting Jalali timestamps to Gregorian datetime...")
            converted_timestamps = [
                parse_jalali_timestamp(value) if isinstance(value, str) else None
                for value in df["timestamp"].to_list()
            ]
            df = df.with_columns(
                pl.Series(converted_timestamps, dtype=pl.Datetime("us")).alias("timestamp")
            )
            print("✅ Jalali timestamp conversion complete.")
    except FileNotFoundError:
        print("❌ Error: File 'dataset.csv' not found inside /app directory.")
        return

    # نوشتن در دیتابیس
    print("⏳ Writing to PostgreSQL (this might take a while for huge files)...")
    df.write_database(
        table_name=table_name,
        connection=DATABASE_URL,
        if_table_exists="replace",
        engine="adbc"
    )
    print(f"✅ Data imported to table {table_name}.")

    # ----- بخش جدید: ساخت ایندکس‌ها -----
    print("⏳ Creating indexes (This will greatly speed up queries)...")
    try:
        # اتصال به دیتابیس با psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        # فعال کردن autocommit ضروری است چون دستورات CREATE INDEX نمی‌توانند در یک تراکنش (transaction) اجرا شوند
        conn.autocommit = True 
        cursor = conn.cursor()

        # Create indexes based on table type
        if table_name == "process_case":
            # ساخت ایندکس روی ستون case_id
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_process_case_case_id ON process_case (case_id);")
            
            # ساخت ایندکس روی ستون timestamp
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_process_case_timestamp ON process_case (timestamp);")
            
            # ساخت ایندکس روی ستون unit_id
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_process_case_unit_id ON process_case (unit_id);")
            
            # Composite index for common query patterns
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_process_case_unit_time ON process_case (unit_id, timestamp);")
        elif table_name == "dim_unit":
            # ساخت ایندکس روی ID در dim_unit (uppercase ID)
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dim_unit_id ON dim_unit ("ID");')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dim_unit_lev2_name ON dim_unit ("LEV2_NAME");')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dim_unit_lev3_name ON dim_unit ("LEV3_NAME");')
        else:
            # Default indexes for other tables
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_case_id ON {table_name} (case_id);")
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table_name}_timestamp ON {table_name} (timestamp);")

        cursor.close()
        conn.close()
        print("✅ Indexes created successfully.")
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")

    print("🎉 Success! Entire process finished.")

if __name__ == "__main__":
    load_parquet_to_db(file_path="dim_unit.csv", table_name="dim_unit", delimiter="\x1b")
    load_parquet_to_db(file_path="process_case.csv", column_names={"CASENO": "case_id", "UNITID": "unit_id", "DATETIME": "timestamp", "COURTTYPETITLE": "activity"}, table_name="process_case", delimiter="\x1b")