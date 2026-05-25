import msgpack
import polars as pl
from fastapi import APIRouter, Query, Response, Request
from app.config import DATABASE_URL
from app.services import ETL, variants, graph
import zstandard as zstd
import pyarrow as pa
import pyarrow.ipc as ipc
import io
from collections import defaultdict

router = APIRouter()

# Cache برای schema اطلاعات
_SCHEMA_CACHE = None

def dataframe_to_arrow_ipc(df: pl.DataFrame) -> bytes:
    """Convert Polars DataFrame to Arrow IPC bytes.
    Handles LargeList/LargeString -> List/String conversion for JS compatibility.
    """
    arrow_table = df.to_arrow()
    new_fields = []
    new_columns = []
    
    for i, field in enumerate(arrow_table.schema):
        column = arrow_table.column(i)
        
        if pa.types.is_large_list(field.type):
            value_type = field.type.value_type
            if pa.types.is_large_string(value_type):
                value_type = pa.string()
            new_type = pa.list_(value_type)
            new_field = pa.field(field.name, new_type)
            new_column = column.cast(new_type)
            new_fields.append(new_field)
            new_columns.append(new_column)
        elif pa.types.is_large_string(field.type):
            new_field = pa.field(field.name, pa.string())
            new_column = column.cast(pa.string())
            new_fields.append(new_field)
            new_columns.append(new_column)
        else:
            new_fields.append(field)
            new_columns.append(column)
    
    new_schema = pa.schema(new_fields)
    arrow_table = pa.table(dict(zip([f.name for f in new_fields], new_columns)), schema=new_schema)
    
    sink = io.BytesIO()
    with ipc.new_stream(sink, arrow_table.schema) as writer:
        writer.write_table(arrow_table)
    
    return sink.getvalue()


def _quote_sql_list(values: list[str]) -> str:
    return ", ".join("'" + value.replace("'", "''") + "'" for value in values)


def _get_level_column_names() -> dict[str, str]:
    try:
        query = "SELECT * FROM dim_unit LIMIT 0"
        df = pl.read_database_uri(query=query, uri=DATABASE_URL, engine="connectorx")
        
        level_columns = [col for col in df.columns if col.startswith('LEV') and col.endswith('_NAME')]
        level_columns.sort()
        
        mapping = {}
        for i, col in enumerate(level_columns):
            mapping[f"lev{i+1}_names"] = col
        return mapping
    except Exception as e:
        print(f"⚠️ Error detecting level columns: {e}")
        return {f"lev{i+1}_names": f"LEV{i+1}_NAME" for i in range(8)}


# 🟢 اضافه شدن اندپوینت مورد نیاز فرانت‌اند برای دریافت پویای اسکیما
@router.get("/schema")
async def get_dimension_schema():
    """تشخیص پویای تعداد لایه‌های ابعادی موجود در دیتابیس و ارسال به فرانت‌اند"""
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is not None:
        return _SCHEMA_CACHE
    try:
        column_mapping = _get_level_column_names()
        # مرتب‌سازی کلیدها به ترتیب لول‌ها (lev1, lev2, ...)
        sorted_keys = sorted(column_mapping.keys(), key=lambda x: int(x[3:].split('_')[0]))
        levels = [{"key": k, "label": column_mapping[k]} for k in sorted_keys]
        _SCHEMA_CACHE = {"levels": levels}
        return _SCHEMA_CACHE
    except Exception as e:
        print(f"❌ Error generating schema: {e}")
        return {"levels": []}


def _resolve_unit_ids(level_filters: dict[str, list[str] | None]) -> list[int] | None:
    column_mapping = _get_level_column_names()
    conditions = []
    
    for level_key, values in level_filters.items():
        if values:
            column_name = column_mapping.get(level_key)
            if column_name:
                conditions.append(f'"{column_name}" IN ({_quote_sql_list(values)})')

    if not conditions:
        return None

    query = f'SELECT DISTINCT "ID" FROM dim_unit WHERE {" AND ".join(conditions)}'
    df = pl.read_database_uri(query=query, uri=DATABASE_URL, engine="connectorx")
    return df["ID"].to_list()


def _get_dimension_values(level_filters: dict[str, list[str] | None]) -> dict[str, list[str]]:
    try:
        query = "SELECT * FROM dim_unit LIMIT 0"
        df = pl.read_database_uri(query=query, uri=DATABASE_URL, engine="connectorx")
        level_columns = [col for col in df.columns if col.startswith('LEV') and col.endswith('_NAME')]
        level_columns.sort()
        
        column_mapping = {}
        reverse_mapping = {}
        for i, col in enumerate(level_columns):
            level_key = f"lev{i+1}_names"
            column_mapping[level_key] = col
            reverse_mapping[col] = level_key
        
        values = {}
        for index, column in enumerate(level_columns, start=1):
            level_key = f"lev{index}_names"
            parent_filters = []
            for parent_column in level_columns[:index-1]:
                parent_key = reverse_mapping[parent_column]
                parent_values = level_filters.get(parent_key)
                if parent_values:
                    parent_filters.append(f'"{parent_column}" IN ({_quote_sql_list(parent_values)})')
            
            parent_where_clause = f'WHERE {" AND ".join(parent_filters)}' if parent_filters else ""
            query = f'SELECT DISTINCT "{column}" FROM dim_unit {parent_where_clause} ORDER BY "{column}"'
            df = pl.read_database_uri(query=query, uri=DATABASE_URL, engine="connectorx")
            values[level_key] = df[column].to_list()
        
        return values
    except Exception as e:
        print(f"❌ Error in _get_dimension_values: {e}")
        return {}


@router.get("/filters")
async def get_graph_filters(request: Request):
    """دریافت داینامیک تمام فیلترهای ابعادی از کوئری استرینگ بدون محدودیت لایه"""
    level_filters = defaultdict(list)
    for key, value in request.query_params.multi_items():
        if key.startswith("lev"):
            level_filters[key].append(value)
            
    return _get_dimension_values(dict(level_filters))


@router.post("/data")
async def get_graph_data(
    request: Request,
    start_date: str = Query(None),
    end_date: str = Query(None),
    unit_id: int = Query(None),
    weight_metric: str = Query("cases"),
    time_unit: str = Query("d"),
    min_cases: int = Query(None),
    max_cases: int = Query(None),
    min_mean_time: int = Query(None),
    max_mean_time: int = Query(None),
    target_coverage: float = Query(0.95),
):
    try:
        level_filters = defaultdict(list)
        for key, value in request.query_params.multi_items():
            if key.startswith("lev"):
                level_filters[key].append(value)
                
        try:
            body = await request.json()
            body_filters = body.get("dimensionFilters", {})
            for k, v in body_filters.items():
                if v:
                    level_filters[k] = v
        except Exception:
            pass

        lf = ETL.get_lazyframe(start_date, end_date) 
        
        effective_unit_ids = _resolve_unit_ids(dict(level_filters))
        if unit_id is not None and effective_unit_ids is not None:
            effective_unit_ids = [uid for uid in effective_unit_ids if uid == unit_id]
        elif unit_id is not None:
            effective_unit_ids = [unit_id]

        pareto_df, all_vars_df, start_nodes, end_nodes = variants.get_variants_logic(
            lf, target_coverage, unit_id=unit_id, unit_ids=effective_unit_ids,
        )
        
        graph_df = graph.generate_graph_from_variants(
            pareto_df, weight_metric=weight_metric, time_unit=time_unit,
            min_cases=min_cases, max_cases=max_cases, min_mean_time=min_mean_time, max_mean_time=max_mean_time
        )
        
        graph_arrow = dataframe_to_arrow_ipc(graph_df)
        variants_arrow = dataframe_to_arrow_ipc(all_vars_df)
        
        payload = {
            "graphData": graph_arrow, "allVariants": variants_arrow,
            "startActivities": start_nodes, "endActivities": end_nodes, "targetCoverage": target_coverage,
        }
        
        packed_data = msgpack.packb(payload, use_bin_type=True)
        cctx = zstd.ZstdCompressor(level=3)
        compressed_data = cctx.compress(packed_data)
        
        return Response(content=compressed_data, media_type="application/x-arrow-msgpack-zstd")
    except Exception as e:
        raise e