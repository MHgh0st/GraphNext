import polars as pl
import numpy as np
from typing import List, Any


def format_seconds_to_days_expr(col_name: str) -> pl.Expr:
    """
    Polars Expression to convert seconds to formatted string (Vectorized).
    """
    days = pl.col(col_name) / 86400
    return (
        pl.when(pl.col(col_name) == 0)
        .then(pl.lit("0s"))
        .when(pl.col(col_name).is_null())
        .then(pl.lit(""))
        .otherwise(
            pl.format("{} روز ", days.round(2))
        )
    )

def safe_calc_list_stats(times_series: pl.Series, func: Any) -> List[List[float]]:
    """
    Helper to calculate stats (mean/sum) on a list of lists using NumPy.
    
    IMPORTANT: times_series contains nested lists - each element is a list of lists,
    where each inner list represents the timing data from one case.
    
    For example, if 3 cases share the same variant with activities [A, B, C]:
    - Case 1: [0, 100, 300] (times at each activity)
    - Case 2: [0, 120, 280]
    - Case 3: [0, 90, 350]
    
    We need to compute element-wise mean: [0, 103.33, 310]
    """
    print(f"🔍 [UTILS] safe_calc_list_stats: Processing {len(times_series)} rows...")
    
    rows = times_series.to_list()
    results = []
    
    for idx, case_times_list in enumerate(rows):
        # case_times_list is a list of lists, e.g. [[0, 100, 300], [0, 120, 280], [0, 90, 350]]
        if not case_times_list:
            print(f"   [UTILS] Row {idx}: Empty list, appending []")
            results.append([])
            continue
        
        try:
            # Debug: show structure of first few rows
            if idx < 3:
                print(f"   [UTILS] Row {idx}: Got {len(case_times_list)} cases, first case has {len(case_times_list[0]) if case_times_list and case_times_list[0] else 0} times")
            
            # Filter out empty inner lists and get only lists with matching lengths
            valid_lists = [lst for lst in case_times_list if lst and len(lst) > 0]
            
            if not valid_lists:
                print(f"   [UTILS] Row {idx}: No valid inner lists found, appending []")
                results.append([])
                continue
            
            # Find the most common length (the expected path length)
            lengths = [len(lst) for lst in valid_lists]
            if not lengths:
                results.append([])
                continue
                
            # Use the most common length
            from collections import Counter
            most_common_length = Counter(lengths).most_common(1)[0][0]
            
            # Filter to only lists with the most common length
            matching_lists = [lst for lst in valid_lists if len(lst) == most_common_length]
            
            if not matching_lists:
                results.append([])
                continue
            
            # Now we can safely create a 2D numpy array
            arr = np.array(matching_lists, dtype=np.float64)
            
            if arr.size > 0 and arr.ndim == 2:
                res = func(arr, axis=0).tolist()
                if not isinstance(res, list):
                    res = [res]
                results.append([round(x, 2) for x in res])
            else:
                # 1D array (single case) - just use the values directly
                if arr.ndim == 1:
                    results.append([round(x, 2) for x in arr.tolist()])
                else:
                    results.append([])
                    
        except Exception as e:
            print(f"❌ [UTILS] Row {idx}: Exception: {e}")
            results.append([])
    
    # Summary
    non_empty = sum(1 for r in results if len(r) > 0)
    print(f"✅ [UTILS] safe_calc_list_stats: Done. {non_empty}/{len(results)} rows have non-empty results.")
    
    return results