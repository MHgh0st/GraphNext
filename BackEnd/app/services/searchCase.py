import polars as pl
from typing import List, Dict, Tuple, Optional


def get_case_position_stats(target_duration: float, all_durations: List[float]) -> Tuple[float, bool]:
    """Calculates percentile and average comparison."""
    if not all_durations:
        return 0, False
    
    # Bisect requires sorted list. In large scale, maybe cache this?
    # For now, sorting here is safer.
    all_durations.sort()
    idx = bisect.bisect_left(all_durations, target_duration)
    percentile = (idx / len(all_durations)) * 100
    avg_duration = sum(all_durations) / len(all_durations)
    
    return percentile, target_duration > avg_duration

def search_case_logic(lf: pl.LazyFrame, target_case_id: int, df_global_context: Optional[pl.DataFrame] = None) -> Optional[Dict]:
    """Finds a case and compares it to the global context."""
    case_df = lf.filter(pl.col('CaseID') == pl.lit(target_case_id)).collect()

    if case_df.is_empty():
        return None

    case_df = case_df.sort('Timestamp')
    activities = case_df['Activity'].to_list()
    
    # Calculate edge durations
    case_df = case_df.with_columns((pl.col('Timestamp').shift(-1) - pl.col('Timestamp')).dt.total_seconds().fill_null(0).alias('Edge_Duration'))
    edge_durations = case_df['Edge_Duration'].to_list()
    if edge_durations:
        edge_durations.pop() # Remove last 0

    total_duration = 0
    if len(case_df) > 1:
        total_duration = (case_df['Timestamp'][-1] - case_df['Timestamp'][0]).total_seconds()

    stats = {}
    if df_global_context is not None:
         global_agg = df_global_context.group_by('CaseID').agg([
             (pl.col('Timestamp').max() - pl.col('Timestamp').min()).dt.total_seconds().alias('Total_Duration'),
             pl.len().alias('Case_Length') 
         ]).filter(pl.col('Case_Length') > 1)
         
         global_durations = global_agg['Total_Duration'].drop_nulls().to_list()
         percentile, is_slower = get_case_position_stats(total_duration, global_durations)
         
         stats = {
             "duration_percentile": round(percentile, 2),
             "is_slower_than_average": is_slower
         }

    return {
        "nodes": activities,
        "edge_durations": edge_durations,
        "total_duration": total_duration,
        "case_id": target_case_id,
        "position_stats": stats
    }