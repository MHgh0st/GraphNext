import polars as pl
from app.config import DATABASE_URL
import os
from typing import Optional

CPU_CORES = os.cpu_count() or 1
PARTITIONS = min(CPU_CORES, 8)


def load_data_from_db(query : str = "SELECT \"case_id\", \"activity\", \"timestamp\" FROM test_1"):
    """
    خواندن فوق‌سریع دیتا از دیتابیس با استفاده از ConnectorX
    """
    print("🚀 [ETL] load_data_from_db: Fetching data from DB using ConnectorX...")
    print(f"   [ETL] Query: {query}")
    
    # 1. خواندن دیتا با موتور connectorx
    # این دستور دیتا را مستقیم به مموری Arrow می‌آورد
    df = pl.read_database_uri(
        query=query,
        uri=DATABASE_URL,
        engine="connectorx",  
        partition_on="case_id", 
        partition_num= PARTITIONS            
    )
    
    print(f"✅ [ETL] load_data_from_db: Loaded {df.shape[0]} rows, {df.shape[1]} columns.")
    print(f"   [ETL] Columns: {df.columns}")
    
    return df.lazy()


def standardize_columns(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Renames first 3 columns to standard CaseID, Activity, Timestamp and casts time."""
    print("🔄 [ETL] standardize_columns: Renaming columns...")
    current_cols = lf.collect_schema().names()
    print(f"   [ETL] Current columns: {current_cols}")
    
    if len(current_cols) >= 3:
        lf = lf.rename({
            'case_id': 'CaseID',
            'activity': 'Activity',
            'timestamp': 'Timestamp'
        })
    
    lf = lf.with_columns(pl.col('Timestamp').cast(pl.Datetime))
    print("✅ [ETL] standardize_columns: Done.")
    return lf

def enrich_event_log(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Adds ranking, case start time, and seconds from start."""
    print("🔄 [ETL] enrich_event_log: Adding ranking and timing columns...")
    lf = lf.with_columns(pl.col('Timestamp').cast(pl.Datetime))
    # Sorting is essential for rank and duration calc
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


def apply_time_filter(lf: pl.LazyFrame, start_date: Optional[str], end_date: Optional[str]) -> pl.LazyFrame:
    """Filters the event log based on timestamp."""
    print(f"🔄 [ETL] apply_time_filter: start_date={start_date}, end_date={end_date}")
    
    if start_date:
        lf = lf.filter(pl.col('Timestamp') >= pl.lit(start_date).str.to_datetime())
        print(f"   [ETL] Applied start_date filter: >= {start_date}")
    if end_date:
        lf = lf.filter(pl.col('Timestamp') <= pl.lit(end_date).str.to_datetime())
        print(f"   [ETL] Applied end_date filter: <= {end_date}")
    
    print("✅ [ETL] apply_time_filter: Done.")
    return lf


def get_lazyframe(start_date: Optional[str], end_date: Optional[str]) -> pl.LazyFrame:
    """Standard pipeline to get the prepared LazyFrame."""
    print("=" * 60)
    print("🚀 [ETL] get_lazyframe: Starting ETL pipeline...")
    print(f"   [ETL] Parameters: start_date={start_date}, end_date={end_date}")
    
    lf = load_data_from_db()
    lf = standardize_columns(lf)
    
    print("🔄 [ETL] Filtering null timestamps...")
    lf = lf.filter(pl.col('Timestamp').is_not_null())
    
    lf = apply_time_filter(lf, start_date, end_date)
    lf = enrich_event_log(lf)
    
    print("✅ [ETL] get_lazyframe: ETL pipeline complete.")
    print("=" * 60)
    return lf