import polars as pl
import numpy  as np
from typing import List, Dict, Any


def calculate_histogram(values: List[float], bins: int = 30, is_integer: bool = False) -> Dict[str, List]:
    """Calculates histogram bins and counts safely."""
    if not values:
        return {"bins": [], "counts": []}
    
    values_arr = np.array(values)

    if is_integer:
        min_v = int(values_arr.min())
        max_v = int(values_arr.max())
        unique_count = max_v - min_v + 1
        
        if unique_count < bins:
            bin_edges = np.arange(min_v, max_v + 2)
        else:
            bin_edges = np.histogram_bin_edges(values_arr, bins=bins)
            bin_edges = np.unique(np.round(bin_edges).astype(int))
    else:
        if values_arr.min() == values_arr.max():
             val = values_arr.min()
             if val == 0:
                 bin_edges = np.linspace(-1, 1, bins + 1)
             else:
                 bin_edges = np.linspace(val * 0.9, val * 1.1, bins + 1)
        else:
            bin_edges = bins

    hist, final_bin_edges = np.histogram(values_arr, bins=bin_edges)
    
    return {
        "bins": final_bin_edges.tolist(),
        "counts": hist.tolist()
    }

def get_global_statistics(df: pl.DataFrame) -> Dict[str, Any]:
    """Calculates global stats (Case Length & Duration)."""
    case_stats = df.group_by('CaseID').agg([
        (pl.col('Timestamp').max() - pl.col('Timestamp').min()).dt.total_seconds().alias('Total_Duration'),
        pl.len().alias('Case_Length')
    ]).filter(pl.col('Case_Length') > 1)
    
    total_durations = case_stats['Total_Duration'].drop_nulls().to_list()
    case_lengths = case_stats['Case_Length'].to_list()
    
    return {
        "total_time": calculate_histogram(total_durations, bins=40, is_integer=False),
        "steps": calculate_histogram(case_lengths, bins=40, is_integer=True)
    }

def get_single_edge_statistics(df: pl.DataFrame, source: str, target: str) -> Dict[str, List]:
    """Calculates duration distribution for a specific edge."""
    # Pre-filter to minimal needed columns/rows to speed up
    q = df.lazy().sort(['CaseID', 'Timestamp'])
    q = q.with_columns([
        pl.col('Activity').shift(-1).over('CaseID').alias('Target_Activity'),
        pl.col('Timestamp').shift(-1).over('CaseID').alias('Target_Timestamp')
    ])

    q = q.filter(
        (pl.col('Activity') == pl.lit(source)) & 
        (pl.col('Target_Activity') == pl.lit(target))
    )

    q = q.with_columns(
        (pl.col('Target_Timestamp') - pl.col('Timestamp')).dt.total_seconds().alias('Raw_Duration')
    )

    # Average per case ID to normalize
    durations = q.group_by('CaseID').agg(
        pl.col('Raw_Duration').mean().alias('Avg_Duration_Per_Case')
    ).collect().get_column('Avg_Duration_Per_Case').to_list()

    return calculate_histogram(durations, bins=30)
