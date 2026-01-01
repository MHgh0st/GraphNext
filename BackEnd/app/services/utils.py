import polars as pl
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
    Handles empty lists and exceptions gracefully.
    """
    rows = times_series.to_list()
    results = []
    for lst in rows:
        if not lst:
            results.append([])
            continue
        try:
            arr = np.array(lst)
            # Check if array is not empty to avoid warnings/errors
            if arr.size > 0:
                res = func(arr, axis=0).tolist()
                if not isinstance(res, list):
                    res = [res]
                results.append([round(x, 2) for x in res])
            else:
                results.append([])
        except Exception:
            results.append([])
    return results