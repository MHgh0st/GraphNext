import polars as pl
import numpy as np
from typing import List, Any
from collections import Counter

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

def _numpy_calc(times_series: pl.Series, func: Any) -> List[List[float]]:
    """
    کد اورجینال و پایدار خود شما (به عنوان لایه پشتیبان تضمینی)
    """
    rows = times_series.to_list()
    results = []
    
    for idx, case_times_list in enumerate(rows):
        if not case_times_list:
            results.append([])
            continue
        try:
            valid_lists = [lst for lst in case_times_list if lst and isinstance(lst, list) and len(lst) > 0]
            
            if not valid_lists:
                results.append([])
                continue
            
            lengths = [len(lst) for lst in valid_lists]
            if not lengths:
                results.append([])
                continue
                
            most_common_length = Counter(lengths).most_common(1)[0][0]
            matching_lists = [lst for lst in valid_lists if len(lst) == most_common_length]
            
            if not matching_lists:
                results.append([])
                continue
            
            arr = np.array(matching_lists, dtype=np.float64)
            
            if arr.size > 0 and arr.ndim == 2:
                res = func(arr, axis=0).tolist()
                if not isinstance(res, list):
                    res = [res]
                results.append([round(x, 2) for x in res])
            else:
                if arr.ndim == 1:
                    results.append([round(x, 2) for x in arr.tolist()])
                else:
                    results.append([])
                    
        except Exception:
            results.append([])
            
    return results

def _vectorized_calc(times_series: pl.Series, func: Any) -> List[List[float]]:
    """
    لایه پردازش پرسرعت و موازی با موتور Rust پولارز
    """
    n_rows = len(times_series)
    if n_rows == 0:
        return []
        
    is_mean = (func is np.mean) or getattr(func, '__name__', '') == 'mean'
    
    df = times_series.to_frame("Times_List")
    if hasattr(df, "with_row_index"):
        df = df.with_row_index("idx")
    else:
        df = df.with_row_count("idx")
        
    df = df.lazy()
    
    # تشخیص بسیار سخت‌گیرانه Type برای جلوگیری از ارور UInt32
    dtype_str = str(times_series.dtype)
    needs_explode = "List(List" in dtype_str
        
    if needs_explode:
        exploded = df.explode("Times_List")
    else:
        exploded = df
        
    exploded = exploded.filter(
        pl.col("Times_List").is_not_null() & 
        (pl.col("Times_List").list.len() > 0)
    )
    
    exploded = exploded.with_columns(
        pl.col("Times_List").list.len().alias("length")
    )
    
    mode_lengths = exploded.group_by("idx").agg(
        pl.col("length").mode().list.first().alias("mode_len")
    )
    
    valid_rows = exploded.join(mode_lengths, on="idx")
    valid_rows = valid_rows.filter(pl.col("length") == pl.col("mode_len"))
    
    valid_df = valid_rows.collect()
    
    if valid_df.is_empty():
        return [[] for _ in range(n_rows)]
        
    structs = valid_df.select(["idx", pl.col("Times_List").list.to_struct()])
    unnested = structs.unnest("Times_List")
    
    value_cols = [c for c in unnested.columns if c != "idx"]
    if not value_cols:
         return [[] for _ in range(n_rows)]
         
    if is_mean:
        aggs = [pl.col(c).cast(pl.Float64).mean().round(2) for c in value_cols]
    else:
        aggs = [pl.col(c).cast(pl.Float64).sum().round(2) for c in value_cols]
        
    grouped = unnested.group_by("idx").agg(aggs)
    
    def sort_key(col_name):
        try:
            return int(col_name.split('_')[1])
        except:
            return 0
            
    sorted_cols = sorted(value_cols, key=sort_key)
    
    grouped = grouped.select(
        "idx",
        pl.concat_list([pl.col(c) for c in sorted_cols]).alias("Result")
    )
    
    base_df = pl.DataFrame({"idx": range(n_rows)})
    final_df = base_df.join(grouped, on="idx", how="left").sort("idx")
    
    results_list = final_df["Result"].to_list()
    return [x if x is not None else [] for x in results_list]

def safe_calc_list_stats(times_series: pl.Series, func: Any) -> List[List[float]]:
    """
    تابع هیبرید: تلاش برای نهایت سرعت، و پشتیبان‌گیری ایمن در صورت بروز خطای تایپ
    """
    print(f"🔍 [UTILS] safe_calc_list_stats: Processing {len(times_series)} rows...")
    try:
        # 1. تلاش برای استفاده از موتور پرسرعت Polars
        return _vectorized_calc(times_series, func)
    except Exception as e:
        # 2. در صورت بروز هرگونه خطا (مثل ارور Type)، برنامه Crash نمیکند و از کد تضمینی Numpy استفاده می‌کند
        print(f"⚠️ [UTILS] Fast-engine encountered a schema mismatch ({e}). Automatically routing to reliable Numpy fallback...")
        return _numpy_calc(times_series, func)