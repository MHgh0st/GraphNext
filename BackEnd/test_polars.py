import polars as pl
import numpy as np

# Mock df
df = pl.DataFrame({
    'Variant_Path': [['A', 'B', 'C'], ['A', 'B', 'C']],
    'Times_List': [[[0, 10, 30], [0, 15, 35]], [[0, 20], [0, 25]]]
})

print("Times_List:")
print(df['Times_List'])

# To get edge durations:
rows = df['Times_List'].to_list()
edge_durations = []
for variant_cases in rows:
    variant_edges = []
    for case_times in variant_cases:
        diffs = np.diff(case_times).tolist()
        variant_edges.append(diffs)
    edge_durations.append(variant_edges)

print("Edge Durations:")
print(edge_durations)

df = df.with_columns(pl.Series("Edge_Durations_List", edge_durations))
print(df)

