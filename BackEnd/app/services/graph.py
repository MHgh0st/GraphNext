import polars as pl
from typing import List, Dict, Optional
from app.services.utils import format_seconds_to_days_expr
def generate_graph_from_variants(variants_df: pl.DataFrame, weight_metric: str = 'cases', time_unit: str = 'd', 
min_cases: Optional[int] = None, max_cases: Optional[int] = None, min_mean_time: Optional[int] = None, max_mean_time: Optional[int] = None) -> List[Dict]:
    """Generates the DFG (Directly Follows Graph) edges from variants."""
    if variants_df.is_empty():
        return []

    # Create edges by shifting lists
    q = variants_df.lazy().select([
        pl.col('Frequency'),
        pl.col('Variant_Path').list.slice(0, length=pl.col('Variant_Path').list.len() - 1).alias('Source'),
        pl.col('Variant_Path').list.slice(1, length=pl.col('Variant_Path').list.len() - 1).alias('Target'),
        pl.col('Avg_Timings').list.slice(0, length=pl.col('Avg_Timings').list.len() - 1).alias('Source_Time'),
        pl.col('Avg_Timings').list.slice(1, length=pl.col('Avg_Timings').list.len() - 1).alias('Target_Time'),
    ])

    q = q.explode(['Source', 'Target', 'Source_Time', 'Target_Time'])
    q = q.with_columns((pl.col('Target_Time') - pl.col('Source_Time')).alias('Duration'))

    # Aggregation
    edges_agg = q.group_by(['Source', 'Target']).agg([
        pl.col('Frequency').sum().alias('Case_Count'),
        (pl.col('Duration') * pl.col('Frequency')).sum().alias('Total_Duration_Seconds')
    ])

    edges_agg = edges_agg.with_columns(
        (pl.col('Total_Duration_Seconds') / pl.col('Case_Count')).alias('Mean_Duration_Seconds')
    )

    # Formatting
    edges_agg = edges_agg.with_columns([
        format_seconds_to_days_expr('Total_Duration_Seconds').alias('Tooltip_Total_Time'),
        format_seconds_to_days_expr('Mean_Duration_Seconds').alias('Tooltip_Mean_Time')
    ])

    # Weight Metric Logic
    if weight_metric == 'mean_time':
        divisor_map = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800}
        unit_label_map = {'s': 'ثانیه', 'm': 'دقیقه', 'h': 'ساعت', 'd': 'روز', 'w': 'هفته'}
        
        divisor = divisor_map.get(time_unit, 1)
        unit_label = unit_label_map.get(time_unit, 's')

        edges_agg = edges_agg.with_columns([
            (pl.col('Mean_Duration_Seconds') / divisor).alias('Weight_Value'),
            (pl.col('Mean_Duration_Seconds') / divisor).round(2).cast(pl.Utf8).add(f" {unit_label}").alias('Edge_Label')
        ])
    else:
        edges_agg = edges_agg.with_columns([
            pl.col('Case_Count').alias('Weight_Value'),
            pl.col('Case_Count').cast(pl.Int64).cast(pl.Utf8).alias('Edge_Label')
        ])

    final_df = edges_agg.rename({'Source': 'Source_Activity', 'Target': 'Target_Activity'}).select([
        'Source_Activity', 'Target_Activity', 'Mean_Duration_Seconds',
        'Tooltip_Total_Time', 'Tooltip_Mean_Time', 'Weight_Value', 'Edge_Label', 'Case_Count'
    ])

    if min_cases is not None:
        final_df = final_df.filter(pl.col('Case_Count') >= min_cases)
    if max_cases is not None:
        final_df = final_df.filter(pl.col('Case_Count') <= max_cases)
    if min_mean_time is not None:
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') >= min_mean_time)
    if max_mean_time is not None:
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') <= max_mean_time)

    return final_df.collect().to_dicts()