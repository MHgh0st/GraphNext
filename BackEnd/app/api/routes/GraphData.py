import msgpack
import polars as pl
from fastapi import APIRouter, Query, Response
from app.config import DATABASE_URL
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


def _quote_sql_list(values: list[str]) -> str:
    return ", ".join("'" + value.replace("'", "''") + "'" for value in values)


def _resolve_unit_ids(
    lev2_names: list[str] | None,
    lev3_names: list[str] | None,
) -> list[int] | None:
    conditions = []
    if lev2_names:
        conditions.append(f'"LEV2_NAME" IN ({_quote_sql_list(lev2_names)})')
    if lev3_names:
        conditions.append(f'"LEV3_NAME" IN ({_quote_sql_list(lev3_names)})')

    if not conditions:
        return None

    query = (
        'SELECT DISTINCT "ID" FROM dim_unit '
        f'WHERE {" AND ".join(conditions)}'
    )
    df = pl.read_database_uri(query=query, uri=DATABASE_URL, engine="connectorx")
    return df["ID"].to_list()


def _get_dimension_values() -> dict[str, list[str]]:
    lev2_query = 'SELECT DISTINCT "LEV2_NAME" FROM dim_unit ORDER BY "LEV2_NAME"'
    lev3_query = 'SELECT DISTINCT "LEV3_NAME" FROM dim_unit ORDER BY "LEV3_NAME"'

    lev2_df = pl.read_database_uri(query=lev2_query, uri=DATABASE_URL, engine="connectorx")
    lev3_df = pl.read_database_uri(query=lev3_query, uri=DATABASE_URL, engine="connectorx")

    return {
        "lev2_names": lev2_df["LEV2_NAME"].to_list(),
        "lev3_names": lev3_df["LEV3_NAME"].to_list(),
    }


@router.get("/filters")
async def get_graph_filters():
    return _get_dimension_values()


@router.post("/data")
async def get_graph_data(
    start_date: str = Query(None),
    end_date: str = Query(None),
    unit_id: int = Query(None),
    lev2_names: list[str] = Query(None),
    lev3_names: list[str] = Query(None),
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
    print(f"   [API] Unit filter: {unit_id}")
    print(f"   [API] LEV2 filters: {lev2_names}")
    print(f"   [API] LEV3 filters: {lev3_names}")
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date) 
        print("✅ [API] Step 1: ETL complete.\n")
        
        # Resolve dimension-based unit filters before variants calc
        selected_unit_ids = _resolve_unit_ids(lev2_names, lev3_names)
        if unit_id is not None and selected_unit_ids is not None:
            effective_unit_ids = [uid for uid in selected_unit_ids if uid == unit_id]
        elif unit_id is not None:
            effective_unit_ids = [unit_id]
        else:
            effective_unit_ids = selected_unit_ids

        print(f"   [API] Resolved UnitIDs from dimensions: {selected_unit_ids}")
        print(f"   [API] Effective UnitIDs: {effective_unit_ids}")

        # Check if data is empty
        row_count = lf.select(pl.len()).collect().item()
        if row_count == 0:
            print("⚠️ [API] WARNING: ETL returned 0 rows.")
            if start_date or end_date:
                print("   [API] ℹ️ HINT: Your database uses Persian calendar dates (1403/01/04...)")
                print("   [API]    Try removing date filters or use Persian calendar format (YYYY/MM/DD)")
            else:
                print("   [API] ℹ️ Database appears to be empty or not loaded.")
        
        # 2. Variants Calculation
        print("📦 [API] Step 2: Calculating variants...")
        pareto_df, all_vars_df, start_nodes, end_nodes = variants.get_variants_logic(
            lf,
            target_coverage,
            unit_id=unit_id,
            unit_ids=effective_unit_ids,
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