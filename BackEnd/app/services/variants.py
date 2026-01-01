import polars as pl
from typing import List
import numpy as np
from app.services.utils import safe_calc_list_stats



def calculate_case_aggregations(df_lazy: pl.LazyFrame) -> pl.LazyFrame:
    """Groups by CaseID to create variant paths and timing lists."""
    return df_lazy.group_by('CaseID').agg([
        pl.col('Activity').alias('Variant_Path'),
        pl.col('Seconds_From_Start').alias('Times_List'),
        (pl.col('Event_Rank').first() == 1).cast(pl.Int32).alias('Is_True_Start'),
        (pl.col('Event_Rank').last() == pl.col('Max_Rank').first()).cast(pl.Int32).alias('Is_True_End')
    ])

def calculate_variant_frequencies(cases_agg: pl.LazyFrame) -> pl.DataFrame:
    """Aggregates cases into unique variants and counts frequencies."""
    variants_agg = cases_agg.group_by('Variant_Path').agg([
        pl.len().alias('Frequency'),
        pl.col('Times_List'),
        pl.col('Is_True_Start').sum().alias('True_Start_Count'),
        pl.col('Is_True_End').sum().alias('True_End_Count')
    ])

    # Must collect here to perform list length filtering and cumulative sums efficiently
    variants_df = variants_agg.collect()
    return variants_df.filter(pl.col('Variant_Path').list.len() > 1)

def compute_coverage_and_sort(variants_df: pl.DataFrame) -> pl.DataFrame:
    """Adds Percentage and Cumulative Coverage columns."""
    if variants_df.is_empty():
        return variants_df

    total_cases = variants_df['Frequency'].sum()
    variants_df = variants_df.with_columns(
        (pl.col('Frequency') / total_cases * 100).alias('Percentage')
    ).sort('Frequency', descending=True)

    return variants_df.with_columns(
        (pl.col('Percentage').cum_sum() / 100).alias('cum_coverage')
    )

def enrich_variants_with_timings(variants_df: pl.DataFrame) -> pl.DataFrame:
    """Calculates Avg and Total timings for variants using numpy."""
    if variants_df.is_empty():
        return variants_df.with_columns([
             pl.lit([]).alias('Avg_Timings'),
             pl.lit([]).alias('Total_Timings')
        ])

    avg_timings = safe_calc_list_stats(variants_df['Times_List'], np.mean)
    total_timings = safe_calc_list_stats(variants_df['Times_List'], np.sum)

    return variants_df.with_columns([
        pl.Series(avg_timings).alias('Avg_Timings'),
        pl.Series(total_timings).alias('Total_Timings')
    ])

def extract_nodes_heatmap(variants_df: pl.DataFrame, node_type: str, count_col: str, coverage: float = 0.95) -> List[str]:
    """Calculates top start or end nodes based on coverage."""
    counts = {}
    for row in variants_df.iter_rows(named=True):
        path = row['Variant_Path']
        if len(path) > 0 and row[count_col] > 0:
            node = path[0] if node_type == 'start' else path[-1]
            counts[node] = counts.get(node, 0) + row[count_col]

    if not counts:
        return []

    sorted_nodes = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    total_count = sum(counts.values())
    
    if total_count == 0:
        return []

    current_sum = 0
    selected = []
    for node, count in sorted_nodes:
        current_sum += count
        selected.append(node)
        if (current_sum / total_count) >= coverage:
            break
            
    # Fallback: ensure at least one node if something exists
    if not selected and sorted_nodes:
        selected.append(sorted_nodes[0][0])
        
    return selected

def get_variants_logic(df_lazy: pl.LazyFrame, target_coverage: float = 0.95):
    """
    Main function to process variants.
    Refactored to return All Variants + Pareto Variants (No Outliers).
    """
    # 1. Basic Aggregation
    cases_agg = calculate_case_aggregations(df_lazy)
    variants_df = calculate_variant_frequencies(cases_agg) # فرض بر این است که آرگومان min_cases در نسخه شما حذف یا مدیریت شده

    if variants_df.is_empty():
        return pl.DataFrame(), [], [], [], []

    # 2. Compute Coverage
    variants_df = compute_coverage_and_sort(variants_df)

    # 3. Enrich ALL variants with timings (Optimized: Calculate once for all)
    # چون پارتو زیرمجموعه کل است، اگر کل را Enrich کنیم، پارتو هم خودکار دارد.
    variants_df = enrich_variants_with_timings(variants_df)

    # 4. Create Export for ALL variants
    all_variants_export = variants_df.drop('Times_List').to_dicts()

    # 5. Extract Pareto Variants based on coverage
    cutoff_row = variants_df.filter(pl.col('cum_coverage') >= target_coverage).head(1)
    
    if not cutoff_row.is_empty():
        limit_val = cutoff_row['cum_coverage'][0]
        pareto_variants = variants_df.filter(pl.col('cum_coverage') <= limit_val)
    else:
        pareto_variants = variants_df

    # 6. Create Export for Pareto
    pareto_export = pareto_variants.drop('Times_List').to_dicts()

    # 7. Calculate Start/End nodes (Usually based on Pareto to avoid noise)
    start_nodes = extract_nodes_heatmap(pareto_variants, 'start', 'True_Start_Count')
    end_nodes = extract_nodes_heatmap(pareto_variants, 'end', 'True_End_Count')

    # Return: pareto_df, pareto_list, all_list, start_nodes, end_nodes
    return pareto_variants, pareto_export, all_variants_export, start_nodes, end_nodes