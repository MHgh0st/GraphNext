import polars as pl
import numpy as np

def _calc_edge_diffs(times_series):
    rows = times_series.to_list()
    edge_durations = []
    for case_times_list in rows:
        diffs = []
        if case_times_list:
            for lst in case_times_list:
                if lst and isinstance(lst, list) and len(lst) > 1:
                    diffs.append([round(x, 2) for x in np.diff(lst).tolist()])
                else:
                    diffs.append([])
        edge_durations.append(diffs)
    return edge_durations

# Create dummy data: 1 variant, 3 cases
# Case 1: Times = [0, 10, 20] -> Edge diffs = [10, 10]
# Case 2: Times = [0, 100, 200] -> Edge diffs = [100, 100]
# Case 3: Times = [0, 4, 8] -> Edge diffs = [4, 4]
# Mean of node 0: 0. Mean of node 1: (10+100+4)/3 = 38. Mean of node 2: (20+200+8)/3 = 76.
# Mean Edge 1 = 38 - 0 = 38
# Mean Edge 2 = 76 - 38 = 38
# Diffs:
# Case 1: [10, 10]
# Case 2: [100, 100]
# Case 3: [4, 4]
# Median Edge 1 = median(10, 100, 4) = 10
# Median Edge 2 = median(10, 100, 4) = 10

times_series = pl.Series("Times_List", [
    [[0.0, 10.0, 20.0], [0.0, 100.0, 200.0], [0.0, 4.0, 8.0]]
])

diffs = _calc_edge_diffs(times_series)
edge_series = pl.Series("Edge_Durations_List", diffs)

df = edge_series.to_frame("Times_List").with_row_index("idx")
exploded = df.explode("Times_List")
print("Exploded:")
print(exploded)

structs = exploded.select(["idx", pl.col("Times_List").list.to_struct()])
unnested = structs.unnest("Times_List")
print("Unnested:")
print(unnested)

value_cols = [c for c in unnested.columns if c != "idx"]
aggs = [pl.col(c).cast(pl.Float64).median().round(2) for c in value_cols]
grouped = unnested.group_by("idx").agg(aggs)
print("Median:")
print(grouped)

# Now check Mean using the same pipeline as the backend
df_mean = times_series.to_frame("Times_List").with_row_index("idx").explode("Times_List")
unnested_mean = df_mean.select(["idx", pl.col("Times_List").list.to_struct()]).unnest("Times_List")
value_cols_mean = [c for c in unnested_mean.columns if c != "idx"]
aggs_mean = [pl.col(c).cast(pl.Float64).mean().round(2) for c in value_cols_mean]
grouped_mean = unnested_mean.group_by("idx").agg(aggs_mean)
print("Mean (Node Cumulative):")
print(grouped_mean)

