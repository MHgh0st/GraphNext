import polars as pl
from app.config import DATABASE_URL
import os
from typing import Optional

CPU_CORES = os.cpu_count() or 1
PARTITIONS = min(CPU_CORES, 8)


def load_data_from_db(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    خواندن فوق‌سریع دیتا از دیتابیس با استفاده از ConnectorX
    اعمال فیلترهای زمانی مستقیما روی دیتابیس برای جلوگیری از بارگذاری دیتای اضافه
    """
    print("🚀 [ETL] load_data_from_db: Fetching data from DB using ConnectorX...")
    
    # 1. ساخت کوئری داینامیک - حالا از process_case می‌خوانیم که unit_id هم دارد
    base_query = 'SELECT "case_id", "activity", "timestamp", "unit_id" FROM process_case'
    conditions = []
    
    if start_date:
        conditions.append(f"\"timestamp\" >= '{start_date}'")
        print(f"   [ETL] Adding SQL start_date filter: >= {start_date}")
    if end_date:
        conditions.append(f"\"timestamp\" <= '{end_date}'")
        print(f"   [ETL] Adding SQL end_date filter: <= {end_date}")
        
    # چسباندن شروط به کوئری اصلی
    if conditions:
        query = f"{base_query} WHERE {' AND '.join(conditions)}"
    else:
        query = base_query
        
    print(f"   [ETL] Final Query: {query}")
    
    # 2. خواندن دیتا با موتور connectorx
    df = pl.read_database_uri(
        query=query,
        uri=DATABASE_URL,
        engine="connectorx",  
        partition_on="case_id", 
        partition_num=PARTITIONS            
    )
    
    print(f"✅ [ETL] load_data_from_db: Loaded {df.shape[0]} rows, {df.shape[1]} columns.")
    print(f"   [ETL] Columns: {df.columns}")
    
    return df.lazy()


def standardize_columns(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Renames first 3 columns to standard CaseID, Activity, Timestamp and casts time. Preserves UnitID."""
    print("🔄 [ETL] standardize_columns: Renaming columns...")
    current_cols = lf.collect_schema().names()
    print(f"   [ETL] Current columns: {current_cols}")
    
    if len(current_cols) >= 4:
        lf = lf.rename({
            'case_id': 'CaseID',
            'activity': 'Activity',
            'timestamp': 'Timestamp',
            'unit_id': 'UnitID'
        })
    
    timestamp_dtype = lf.collect_schema()['Timestamp']
    if timestamp_dtype == pl.Utf8:
        # Parse Persian calendar strings if the timestamp is still stored as text.
        lf = lf.with_columns(
            pl.col('Timestamp').str.strptime(pl.Datetime, format="%Y/%m/%d-%H:%M", strict=False)
        )
    else:
        # If PostgreSQL already stored a native timestamp type, just cast.
        lf = lf.with_columns(pl.col('Timestamp').cast(pl.Datetime))

    print("✅ [ETL] standardize_columns: Done.")
    return lf

def enrich_event_log(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Adds ranking, case start time, and seconds from start. Preserves UnitID."""
    print("🔄 [ETL] enrich_event_log: Adding ranking and timing columns...")
    lf = lf.with_columns(pl.col('Timestamp').cast(pl.Datetime))
    # Sorting is essential for rank and duration calc - partition by CaseID to preserve UnitID grouping
    lf = lf.sort(['CaseID', 'Timestamp'])
    
    lf = lf.with_columns([
        pl.col('Timestamp').rank('ordinal').over('CaseID').alias('Event_Rank'),
        pl.col('Timestamp').min().over('CaseID').alias('Case_Start_Time')
    ])
    
    lf = lf.with_columns([
        pl.col('Event_Rank').max().over('CaseID').alias('Max_Rank'),
        (pl.col('Timestamp') - pl.col('Case_Start_Time')).dt.total_seconds().alias('Seconds_From_Start')
    ])
    
    print("✅ [ETL] enrich_event_log: Done.")
    return lf


def get_lazyframe(start_date: Optional[str], end_date: Optional[str]) -> pl.LazyFrame:
    """Standard pipeline to get the prepared LazyFrame."""
    print("=" * 60)
    print("🚀 [ETL] get_lazyframe: Starting ETL pipeline...")
    print(f"   [ETL] Parameters: start_date={start_date}, end_date={end_date}")
    
    # 🔴 مرحله طلایی: تاریخ ها را مستقیم به تابع دیتابیس می دهیم
    lf = load_data_from_db(start_date, end_date)
    
    lf = standardize_columns(lf)
    
    print("🔄 [ETL] Filtering null timestamps...")
    lf = lf.filter(pl.col('Timestamp').is_not_null())
    
    # تابع apply_time_filter به صورت کامل حذف شد چون دیتابیس دیتاهای خارج از بازه را نیاورده است
    
    lf = enrich_event_log(lf)
    
    print("✅ [ETL] get_lazyframe: ETL pipeline complete.")
    print("=" * 60)
    return lf