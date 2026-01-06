import msgpack
import polars as pl
from fastapi import APIRouter, Query, Response
from app.services import ETL, variants, graph
import zstandard as zstd
import pyarrow as pa
import pyarrow.ipc as ipc
import io

router = APIRouter()

def dataframe_to_arrow_ipc(df: pl.DataFrame) -> bytes:
    """Convert Polars DataFrame to Arrow IPC bytes.
    
    Handles LargeList/LargeString -> List/String conversion for JS compatibility.
    """
    # Convert Polars to Arrow Table
    arrow_table = df.to_arrow()
    
    # Convert LargeList/LargeString to regular List/String for JS apache-arrow compatibility
    new_fields = []
    new_columns = []
    
    for i, field in enumerate(arrow_table.schema):
        column = arrow_table.column(i)
        
        if pa.types.is_large_list(field.type):
            # Convert LargeList to List
            value_type = field.type.value_type
            # If value type is also Large*, convert it too
            if pa.types.is_large_string(value_type):
                value_type = pa.string()
            new_type = pa.list_(value_type)
            new_field = pa.field(field.name, new_type)
            # Cast the column
            new_column = column.cast(new_type)
            new_fields.append(new_field)
            new_columns.append(new_column)
        elif pa.types.is_large_string(field.type):
            # Convert LargeString to String
            new_field = pa.field(field.name, pa.string())
            new_column = column.cast(pa.string())
            new_fields.append(new_field)
            new_columns.append(new_column)
        else:
            new_fields.append(field)
            new_columns.append(column)
    
    # Create new table with converted types
    new_schema = pa.schema(new_fields)
    arrow_table = pa.table(dict(zip([f.name for f in new_fields], new_columns)), schema=new_schema)
    
    # Serialize to IPC format
    sink = io.BytesIO()
    with ipc.new_stream(sink, arrow_table.schema) as writer:
        writer.write_table(arrow_table)
    
    return sink.getvalue()

@router.post("/data")
async def get_graph_data(
    start_date: str = Query(None),
    end_date: str = Query(None),
    weight_metric: str = Query("cases"),
    time_unit: str = Query("d"),
    min_cases: int = Query(None),
    max_cases: int = Query(None),
    min_mean_time: int = Query(None),
    max_mean_time: int = Query(None),
    target_coverage: float = Query(0.95),
):
    print("=" * 80)
    print("🌐 [API] POST /api/graph/data called (Arrow IPC + MsgPack + Zstd)")
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date) 
        print("✅ [API] Step 1: ETL complete.\n")
        
        # 2. Variants Calculation
        print("📦 [API] Step 2: Calculating variants...")
        pareto_df, all_vars_df, start_nodes, end_nodes = variants.get_variants_logic(
            lf, target_coverage
        )
        print(f"✅ [API] Step 2: Variants complete. Pareto DF shape: {pareto_df.shape}\n")
        
        # 3. Graph Generation
        print("📦 [API] Step 3: Generating graph...")
        graph_df = graph.generate_graph_from_variants(
            pareto_df, 
            weight_metric=weight_metric,
            time_unit=time_unit,
            min_cases=min_cases,
            max_cases=max_cases,
            min_mean_time=min_mean_time,
            max_mean_time=max_mean_time
        )
        print(f"✅ [API] Step 3: Graph generation complete. Edge DF shape: {graph_df.shape}\n")
        
        # 4. Serialization - Convert to Arrow IPC format
        print("📦 [API] Step 4: Serializing to Arrow IPC...")
        
        # Convert DataFrames to Arrow IPC bytes
        graph_arrow = dataframe_to_arrow_ipc(graph_df)
        variants_arrow = dataframe_to_arrow_ipc(all_vars_df)
        
        print(f"   [DEBUG] Graph Arrow size: {len(graph_arrow) / 1024:.2f} KB")
        print(f"   [DEBUG] Variants Arrow size: {len(variants_arrow) / 1024:.2f} KB")
        
        # Bundle with msgpack (Arrow IPC bytes + simple lists)
        payload = {
            "graphData": graph_arrow,
            "allVariants": variants_arrow,
            "startActivities": start_nodes,
            "endActivities": end_nodes,
            "targetCoverage": target_coverage,
        }
        
        packed_data = msgpack.packb(payload, use_bin_type=True)
        
        # Compress with zstd
        cctx = zstd.ZstdCompressor(level=3)
        compressed_data = cctx.compress(packed_data)
        
        print(f"   [DEBUG] Uncompressed size: {len(packed_data) / 1024:.2f} KB")
        print(f"   [DEBUG] Compressed size: {len(compressed_data) / 1024:.2f} KB")
        print("=" * 80)
        print("✅ [API] Request completed successfully!")
        print("=" * 80)
        
        return Response(content=compressed_data, media_type="application/x-arrow-msgpack-zstd")

    except Exception as e:
        print("=" * 80)
        print(f"❌ [API] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 80)
        raise e