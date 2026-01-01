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
    print("🚀 Fetching data from DB using ConnectorX...")
    
    # 1. خواندن دیتا با موتور connectorx
    # این دستور دیتا را مستقیم به مموری Arrow می‌آورد
    df = pl.read_database_uri(
        query=query,
        uri=DATABASE_URL,
        engine="connectorx",  
        partition_on="case_id", 
        partition_num= PARTITIONS            
    )
    
    print(f"✅ Loaded {df.shape[0]} rows.")
    
    return df.lazy()


def enrich_event_log(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Adds ranking, case start time, and seconds from start."""
    # Sorting is essential for rank and duration calc
    lf = lf.sort(['CaseID', 'Timestamp'])
    
    lf = lf.with_columns([
        pl.col('Timestamp').rank('ordinal').over('CaseID').alias('Event_Rank'),
        pl.col('Timestamp').min().over('CaseID').alias('Case_Start_Time')
    ])
    
    return lf.with_columns([
        pl.col('Event_Rank').max().over('CaseID').alias('Max_Rank'),
        (pl.col('Timestamp') - pl.col('Case_Start_Time')).dt.total_seconds().alias('Seconds_From_Start')
    ])


def apply_time_filter(lf: pl.LazyFrame, start_date: Optional[str], end_date: Optional[str]) -> pl.LazyFrame:
    """Filters the event log based on timestamp."""
    if start_date:
        lf = lf.filter(pl.col('Timestamp') >= pl.lit(pd.to_datetime(start_date)))
    if end_date:
        lf = lf.filter(pl.col('Timestamp') <= pl.lit(pd.to_datetime(end_date)))
    return lf


def get_lazyframe(start_date: Optional[str], end_date: Optional[str]) -> pl.LazyFrame:
    """Standard pipeline to get the prepared LazyFrame."""
    lf = load_data_from_db()
    lf = apply_time_filter(lf, start_date, end_date)
    return lf