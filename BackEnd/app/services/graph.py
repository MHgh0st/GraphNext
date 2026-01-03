import polars as pl
from typing import List, Dict, Optional
from app.services.utils import format_seconds_to_days_expr

def generate_graph_from_variants(variants_df: pl.DataFrame, weight_metric: str = 'cases', time_unit: str = 'd', 
min_cases: Optional[int] = None, max_cases: Optional[int] = None, min_mean_time: Optional[int] = None, max_mean_time: Optional[int] = None) -> pl.DataFrame:
    """Generates the DFG (Directly Follows Graph) edges from variants."""
    print("=" * 60)
    print("🚀 [GRAPH] generate_graph_from_variants: Starting...")
    print(f"   [GRAPH] Parameters: weight_metric={weight_metric}, time_unit={time_unit}")
    print(f"   [GRAPH] Filters: min_cases={min_cases}, max_cases={max_cases}, min_mean_time={min_mean_time}, max_mean_time={max_mean_time}")
    print(f"   [GRAPH] Input DataFrame shape: {variants_df.shape}")
    print(f"   [GRAPH] Input DataFrame columns: {variants_df.columns}")
    
    if variants_df.is_empty():
        print("⚠️ [GRAPH] Input DataFrame is empty. Returning [].")
        return []

    # Debug: Check list lengths for Variant_Path and Avg_Timings
    print("🔍 [GRAPH] Checking list lengths for Variant_Path and Avg_Timings...")
    try:
        sample_df = variants_df.head(5).select([
            pl.col('Variant_Path').list.len().alias('Variant_Path_len'),
            pl.col('Avg_Timings').list.len().alias('Avg_Timings_len')
        ])
        print(f"   [GRAPH] Sample list lengths (first 5 rows):\n{sample_df}")
        
        # Check for mismatched lengths
        mismatch_count = variants_df.select(
            (pl.col('Variant_Path').list.len() != pl.col('Avg_Timings').list.len()).sum().alias('mismatch_count')
        ).item()
        print(f"   [GRAPH] Rows with mismatched Variant_Path/Avg_Timings lengths: {mismatch_count}")
        
        if mismatch_count > 0:
            print("⚠️ [GRAPH] WARNING: Found rows with mismatched list lengths! This will cause explode to fail.")
            # Show some examples
            mismatched = variants_df.filter(
                pl.col('Variant_Path').list.len() != pl.col('Avg_Timings').list.len()
            ).head(3).select([
                pl.col('Variant_Path').list.len().alias('Variant_Path_len'),
                pl.col('Avg_Timings').list.len().alias('Avg_Timings_len'),
                pl.col('Frequency')
            ])
            print(f"   [GRAPH] Sample mismatched rows:\n{mismatched}")
    except Exception as e:
        print(f"❌ [GRAPH] Error checking list lengths: {e}")

    print("🔄 [GRAPH] Creating edges by shifting lists...")
    # Create edges by shifting lists
    q = variants_df.lazy().select([
        pl.col('Frequency'),
        pl.col('Variant_Path').list.slice(0, length=pl.col('Variant_Path').list.len() - 1).alias('Source'),
        pl.col('Variant_Path').list.slice(1, length=pl.col('Variant_Path').list.len() - 1).alias('Target'),
        pl.col('Avg_Timings').list.slice(0, length=pl.col('Avg_Timings').list.len() - 1).alias('Source_Time'),
        pl.col('Avg_Timings').list.slice(1, length=pl.col('Avg_Timings').list.len() - 1).alias('Target_Time'),
    ])

    print("🔄 [GRAPH] Exploding columns ['Source', 'Target', 'Source_Time', 'Target_Time']...")
    try:
        q = q.explode(['Source', 'Target', 'Source_Time', 'Target_Time'])
        print("✅ [GRAPH] Explode successful.")
    except Exception as e:
        print(f"❌ [GRAPH] Explode FAILED: {e}")
        raise

    q = q.with_columns((pl.col('Target_Time') - pl.col('Source_Time')).alias('Duration'))
    print("🔄 [GRAPH] Calculated Duration column.")

    # Aggregation
    print("🔄 [GRAPH] Aggregating edges...")
    edges_agg = q.group_by(['Source', 'Target']).agg([
        pl.col('Frequency').sum().alias('Case_Count'),
        (pl.col('Duration') * pl.col('Frequency')).sum().alias('Total_Duration_Seconds')
    ])

    edges_agg = edges_agg.with_columns(
        (pl.col('Total_Duration_Seconds') / pl.col('Case_Count')).alias('Mean_Duration_Seconds')
    )
    print("✅ [GRAPH] Aggregation complete.")

    # Formatting
    print("🔄 [GRAPH] Formatting tooltip columns...")
    edges_agg = edges_agg.with_columns([
        format_seconds_to_days_expr('Total_Duration_Seconds').alias('Tooltip_Total_Time'),
        format_seconds_to_days_expr('Mean_Duration_Seconds').alias('Tooltip_Mean_Time')
    ])

    # Weight Metric Logic
    print(f"🔄 [GRAPH] Applying weight metric: {weight_metric}")
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

    # Apply filters
    if min_cases is not None:
        print(f"🔄 [GRAPH] Filtering: Case_Count >= {min_cases}")
        final_df = final_df.filter(pl.col('Case_Count') >= min_cases)
    if max_cases is not None:
        print(f"🔄 [GRAPH] Filtering: Case_Count <= {max_cases}")
        final_df = final_df.filter(pl.col('Case_Count') <= max_cases)
    if min_mean_time is not None:
        print(f"🔄 [GRAPH] Filtering: Mean_Duration_Seconds >= {min_mean_time}")
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') >= min_mean_time)
    if max_mean_time is not None:
        print(f"🔄 [GRAPH] Filtering: Mean_Duration_Seconds <= {max_mean_time}")
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') <= max_mean_time)

    print("🔄 [GRAPH] Collecting final LazyFrame...")
    try:
        result_df = final_df.collect()
        
        print(f"✅ [GRAPH] generate_graph_from_variants complete. Returning DF with {len(result_df)} edges.")
        print("=" * 60)
        return result_df

    except Exception as e:
        print(f"❌ [GRAPH] Final collect FAILED: {e}")
        raise