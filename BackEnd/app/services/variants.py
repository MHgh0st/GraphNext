import polars as pl
from typing import List
import numpy as np
from app.services.utils import safe_calc_list_stats



def calculate_case_aggregations(df_lazy: pl.LazyFrame) -> pl.LazyFrame:
    """Groups by CaseID to create variant paths and timing lists."""
    print("🔄 [VARIANTS] calculate_case_aggregations: Grouping by CaseID...")
    result = df_lazy.group_by('CaseID').agg([
        pl.col('Activity').alias('Variant_Path'),
        pl.col('Seconds_From_Start').alias('Times_List'),
        (pl.col('Event_Rank').first() == 1).cast(pl.Int32).alias('Is_True_Start'),
        (pl.col('Event_Rank').last() == pl.col('Max_Rank').first()).cast(pl.Int32).alias('Is_True_End')
    ])
    print("✅ [VARIANTS] calculate_case_aggregations: Done.")
    return result

def calculate_variant_frequencies(cases_agg: pl.LazyFrame) -> pl.DataFrame:
    """Aggregates cases into unique variants and counts frequencies."""
    print("🔄 [VARIANTS] calculate_variant_frequencies: Aggregating variants...")
    variants_agg = cases_agg.group_by('Variant_Path').agg([
        pl.len().alias('Frequency'),
        pl.col('Times_List'),
        pl.col('Is_True_Start').sum().alias('True_Start_Count'),
        pl.col('Is_True_End').sum().alias('True_End_Count')
    ])

    # Must collect here to perform list length filtering and cumulative sums efficiently
    print("🔄 [VARIANTS] Collecting variants DataFrame...")
    variants_df = variants_agg.collect()
    print(f"   [VARIANTS] Collected {variants_df.shape[0]} unique variants before filtering.")
    
    filtered_df = variants_df.filter(pl.col('Variant_Path').list.len() > 1)
    print(f"✅ [VARIANTS] calculate_variant_frequencies: {filtered_df.shape[0]} variants after filtering (path length > 1).")
    return filtered_df

def compute_coverage_and_sort(variants_df: pl.DataFrame) -> pl.DataFrame:
    """Adds Percentage and Cumulative Coverage columns."""
    print("🔄 [VARIANTS] compute_coverage_and_sort: Computing coverage...")
    if variants_df.is_empty():
        print("⚠️ [VARIANTS] DataFrame is empty, returning as-is.")
        return variants_df

    total_cases = variants_df['Frequency'].sum()
    print(f"   [VARIANTS] Total cases: {total_cases}")
    
    variants_df = variants_df.with_columns(
        (pl.col('Frequency') / total_cases * 100).alias('Percentage')
    ).sort('Frequency', descending=True)

    variants_df = variants_df.with_columns(
        (pl.col('Percentage').cum_sum() / 100).alias('cum_coverage')
    )
    print("✅ [VARIANTS] compute_coverage_and_sort: Done.")
    return variants_df

def enrich_variants_with_timings(variants_df: pl.DataFrame) -> pl.DataFrame:
    """Calculates Avg and Total timings for variants using numpy."""
    print("🔄 [VARIANTS] enrich_variants_with_timings: Calculating timings...")
    if variants_df.is_empty():
        print("⚠️ [VARIANTS] DataFrame is empty, returning with empty timing columns.")
        return variants_df.with_columns([
             pl.lit([]).alias('Avg_Timings'),
             pl.lit([]).alias('Total_Timings')
        ])

    print(f"   [VARIANTS] Processing {variants_df.shape[0]} variants...")
    avg_timings = safe_calc_list_stats(variants_df['Times_List'], np.mean)
    total_timings = safe_calc_list_stats(variants_df['Times_List'], np.sum)
    
    # Debug: Check lengths
    print(f"   [VARIANTS] Sample Variant_Path lengths: {variants_df.head(5).select(pl.col('Variant_Path').list.len()).to_series().to_list()}")
    print(f"   [VARIANTS] Sample Avg_Timings lengths: {[len(x) for x in avg_timings[:5]]}")

    result = variants_df.with_columns([
        pl.Series(avg_timings).alias('Avg_Timings'),
        pl.Series(total_timings).alias('Total_Timings')
    ])
    
    # Verify lengths match
    mismatch_check = result.select(
        (pl.col('Variant_Path').list.len() != pl.col('Avg_Timings').list.len()).sum().alias('mismatches')
    ).item()
    if mismatch_check > 0:
        print(f"⚠️ [VARIANTS] WARNING: {mismatch_check} rows have mismatched Variant_Path/Avg_Timings lengths!")
    else:
        print("   [VARIANTS] All Variant_Path and Avg_Timings lengths match ✓")
    
    print("✅ [VARIANTS] enrich_variants_with_timings: Done.")
    return result

def extract_nodes_heatmap(variants_df: pl.DataFrame, node_type: str, count_col: str, coverage: float = 0.95) -> List[str]:
    """Calculates top nodes utilizing fast Polars group_by operations instead of iter_rows."""
    print(f"🔄 [VARIANTS] extract_nodes_heatmap: Extracting {node_type} nodes (Polars Optimized)...")
    
    if variants_df.is_empty():
        return []

    # انتخاب نود اول یا آخر با استفاده از متدهای list
    target_index = 0 if node_type == 'start' else -1
    
    # 1. استخراج نودها و تعدادشان
    nodes_agg = (
        variants_df
        .filter(pl.col(count_col) > 0)
        .select([
            pl.col('Variant_Path').list.get(target_index).alias('Node'),
            pl.col(count_col)
        ])
        .group_by('Node')
        .agg(pl.col(count_col).sum().alias('Total_Count'))
        .sort('Total_Count', descending=True)
    )

    if nodes_agg.is_empty():
        return []

    total_count = nodes_agg['Total_Count'].sum()
    nodes_agg = nodes_agg.with_columns(
        (pl.col('Total_Count').cum_sum() / total_count).alias('Running_Coverage')
    )

    selected_nodes = (
        nodes_agg
        .filter(
            (pl.col('Running_Coverage').shift(1, fill_value=0.0) < coverage)
        )
        .select('Node')
        .to_series()
        .to_list()
    )

    print(f"✅ [VARIANTS] extract_nodes_heatmap: Found {len(selected_nodes)} {node_type} nodes.")
    return selected_nodes

def get_variants_logic(df_lazy: pl.LazyFrame, target_coverage: float = 0.95):
    print("=" * 60)
    print("🚀 [VARIANTS] get_variants_logic: Starting...")
    
    # 1. Aggregation
    cases_agg = calculate_case_aggregations(df_lazy)
    variants_df = calculate_variant_frequencies(cases_agg)

    if variants_df.is_empty():
        return pl.DataFrame(), pl.DataFrame(), [], []

    # 2. Compute Coverage
    variants_df = compute_coverage_and_sort(variants_df)

    # 3. Enrich with Timings
    variants_df = enrich_variants_with_timings(variants_df)

    # 4. 🔥 CLEANUP & RECHUNK 🔥
    wanted_columns = [
        'Variant_Path', 
        'Frequency', 
        'True_Start_Count', 
        'True_End_Count', 
        'Percentage', 
        'cum_coverage', 
        'Avg_Timings', 
        'Total_Timings'
    ]
    
    print(f"✂️ [VARIANTS] Selecting columns: {wanted_columns}")
    
    available_cols = variants_df.columns
    cols_to_select = [c for c in wanted_columns if c in available_cols]
    
    # انتخاب ستون‌ها
    variants_df_clean = variants_df.select(cols_to_select)
    
    # 🛑🛑🛑 نکته طلایی اینجاست: rechunk() 🛑🛑🛑
    # این دستور باعث می‌شود Polars حافظه را از نو بسازد و دیتای اضافی (Times_List) را فیزیکی دور بریزد.
    print("🧹 [VARIANTS] Re-chunking DataFrame to release unused memory...")
    variants_df_clean = variants_df_clean.rechunk()

    # دیباگ سایز
    est_size_mb = variants_df_clean.estimated_size() / (1024 * 1024)
    print(f"📉 [VARIANTS] Clean DataFrame Size: {est_size_mb:.2f} MB | Shape: {variants_df_clean.shape}")

    # 5. Prepare Outputs
    cutoff_row = variants_df_clean.filter(pl.col('cum_coverage') >= target_coverage).head(1)
    
    if not cutoff_row.is_empty():
        limit_val = cutoff_row['cum_coverage'][0]
        pareto_variants_df = variants_df_clean.filter(pl.col('cum_coverage') <= limit_val)
    else:
        pareto_variants_df = variants_df_clean

    # 6. Extract Nodes
    start_nodes = extract_nodes_heatmap(pareto_variants_df, 'start', 'True_Start_Count')
    end_nodes = extract_nodes_heatmap(pareto_variants_df, 'end', 'True_End_Count')

    print(f"✅ [VARIANTS] Complete.")
    print("=" * 60)
    
    return pareto_variants_df, variants_df_clean, start_nodes, end_nodes