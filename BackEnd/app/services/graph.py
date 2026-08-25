import polars as pl
from typing import List, Dict, Optional
from app.services.utils import format_seconds_to_days_expr

def generate_graph_from_variants(
        variants_df: pl.DataFrame,
        weight_metric: str = 'cases',
        time_unit: str = 'd',
        min_cases: Optional[int] = None,
        max_cases: Optional[int] = None,
        min_mean_time: Optional[int] = None,
        max_mean_time: Optional[int] = None
) -> pl.DataFrame:
    """
    Generates the DFG (Directly Follows Graph) edges from variants with
    advanced process mining stats (Min, Max, Std, Median, Branching Probability, and Rework Loops).
    """
    print("=" * 60)
    print("🚀 [GRAPH] generate_graph_from_variants: Starting Advanced Analytics Engine...")
    print(f"   [GRAPH] Parameters: weight_metric={weight_metric}, time_unit={time_unit}")

    # ─── ۱. مدیریت ساختار دیتای خالی (Empty State DataFrame) ───
    if variants_df.is_empty():
        print("⚠️ [GRAPH] Input DataFrame is empty. Returning comprehensive empty schema.")
        return pl.DataFrame({
            'Source_Activity': pl.Series([], dtype=pl.Utf8),
            'Target_Activity': pl.Series([], dtype=pl.Utf8),
            'Mean_Duration_Seconds': pl.Series([], dtype=pl.Float64),
            'Tooltip_Total_Time': pl.Series([], dtype=pl.Utf8),
            'Tooltip_Mean_Time': pl.Series([], dtype=pl.Utf8),
            'Weight_Value': pl.Series([], dtype=pl.Float64),
            'Edge_Label': pl.Series([], dtype=pl.Utf8),
            'Case_Count': pl.Series([], dtype=pl.Int64),
            'Min_Duration_Seconds': pl.Series([], dtype=pl.Float64),
            'Max_Duration_Seconds': pl.Series([], dtype=pl.Float64),
            'Std_Duration_Seconds': pl.Series([], dtype=pl.Float64),
            'Median_Duration_Seconds': pl.Series([], dtype=pl.Float64),
            'Branching_Probability': pl.Series([], dtype=pl.Float64),
        })

    # ─── ۲. آماده‌سازی خط لوله تنبل و ایجاد شناسه یکتا برای هر واریانت ───
    # ایجاد یک کانتور فرضی (Variant_ID) برای ردگیری لوپ‌ها در دل هر واریانت واحد قبل از متلاشی کردن (Explode)
    v_lazy = variants_df.lazy().with_columns(
        pl.lit(1).cum_sum().alias("Variant_ID")
    )

    print("🔄 [GRAPH] Creating edges by shifting and slicing lists...")
    q = v_lazy.select([
        pl.col('Variant_ID'),
        pl.col('Frequency'),
        pl.col('Variant_Path').list.slice(0, length=pl.col('Variant_Path').list.len() - 1).alias('Source'),
        pl.col('Variant_Path').list.slice(1, length=pl.col('Variant_Path').list.len() - 1).alias('Target'),
        pl.col('Avg_Timings').list.slice(0, length=pl.col('Avg_Timings').list.len() - 1).alias('Source_Time'),
        pl.col('Avg_Timings').list.slice(1, length=pl.col('Avg_Timings').list.len() - 1).alias('Target_Time'),
    ])

    print("🔄 [GRAPH] Exploding columns and calculating transitions...")
    q = q.explode(['Source', 'Target', 'Source_Time', 'Target_Time'])
    q = q.with_columns((pl.col('Target_Time') - pl.col('Source_Time')).alias('Duration'))

    # جمع‌آوری داده‌های منفجر شده جهت انجام محاسبات هیبریدی و پنجره‌ای پیشرفته
    df_exploded = q.collect()

    # ─── ۴. تجمع داده‌های اصلی یال‌ها (Edges Aggregation Core) ───
    print("🔄 [GRAPH] Aggregating edges and calculating analytical metrics...")
    edges_agg = df_exploded.group_by(['Source', 'Target']).agg([
        pl.col('Frequency').sum().alias('Case_Count'),
        (pl.col('Duration') * pl.col('Frequency')).sum().alias('Total_Duration_Seconds'),
        ((pl.col('Duration') ** 2) * pl.col('Frequency')).sum().alias('Total_Duration_Squared'),
        pl.col('Duration').min().alias('Min_Duration_Seconds'),
        pl.col('Duration').max().alias('Max_Duration_Seconds')
    ])

    # ─── ۵. محاسبه ۱۰۰٪ برداری میانه وزن‌دار کیس‌ها (Case-level Weighted Median) ───
    median_df = (
        df_exploded
        .sort(['Source', 'Target', 'Duration'])
        .with_columns([
            pl.col('Frequency').cum_sum().over(['Source', 'Target']).alias('cum_freq'),
            pl.col('Frequency').sum().over(['Source', 'Target']).alias('total_freq')
        ])
        .filter(pl.col('cum_freq') >= pl.col('total_freq') / 2.0)
        .group_by(['Source', 'Target'])
        .agg(pl.col('Duration').first().alias('Median_Duration_Seconds'))
    )

    # ادغام اطلاعات میانه با بدنه اصلی لبه‌ها
    edges_agg = edges_agg.join(median_df, on=['Source', 'Target'], how='left')

    # محاسبه میانگین زمانی و مجموع کلید منبع برای نرخ احتمال انشعاب
    edges_agg = edges_agg.with_columns([
        (pl.col('Total_Duration_Seconds') / pl.col('Case_Count')).alias('Mean_Duration_Seconds'),
        pl.col('Case_Count').sum().over('Source').alias('Source_Total_Count')
    ])

    # ─── ۶. محاسبه انحراف معیار (Std Dev) و نرخ احتمال انشعاب (Branching Probability) ───
    edges_agg = edges_agg.with_columns([
        ((pl.col('Total_Duration_Squared') / pl.col('Case_Count')) - (pl.col('Mean_Duration_Seconds') ** 2)).clip(lower_bound=0).sqrt().alias('Std_Duration_Seconds'),
        (pl.col('Case_Count') / pl.col('Source_Total_Count') * 100).round(2).alias('Branching_Probability')
    ])

    # فرمت‌بندی تولتیپ‌های متنی پیش‌فرض سیستم
    edges_agg = edges_agg.with_columns([
        format_seconds_to_days_expr('Total_Duration_Seconds').alias('Tooltip_Total_Time'),
        format_seconds_to_days_expr('Mean_Duration_Seconds').alias('Tooltip_Mean_Time')
    ])

    # ─── ۷. لایه منطق اعمال معیار وزن گراف (Weight Metric Logic) ───
    print(f"🔄 [GRAPH] Applying weight metric layout: {weight_metric}")
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

    # تغییر نام ستون‌ها متناسب با ساختار درخواستی فرانت‌اَند
    final_df = edges_agg.rename({'Source': 'Source_Activity', 'Target': 'Target_Activity'}).select([
        'Source_Activity', 'Target_Activity', 'Mean_Duration_Seconds',
        'Tooltip_Total_Time', 'Tooltip_Mean_Time', 'Weight_Value', 'Edge_Label', 'Case_Count',
        'Min_Duration_Seconds', 'Max_Duration_Seconds', 'Std_Duration_Seconds', 'Median_Duration_Seconds', 'Branching_Probability'
    ])

    # ─── ۸. اعمال فیلترهای ماتریسی کلاینت بر بستر حافظه پیوسته ───
    if min_cases is not None:
        final_df = final_df.filter(pl.col('Case_Count') >= min_cases)
    if max_cases is not None:
        final_df = final_df.filter(pl.col('Case_Count') <= max_cases)
    if min_mean_time is not None:
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') >= min_mean_time)
    if max_mean_time is not None:
        final_df = final_df.filter(pl.col('Mean_Duration_Seconds') <= max_mean_time)

    print(f"✅ [GRAPH] generate_graph_from_variants complete. Returning {final_df.shape[0]} processed edges.")
    print("=" * 60)

    return final_df