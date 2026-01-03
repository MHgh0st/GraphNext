import io
import msgpack
import polars as pl
from fastapi import APIRouter, Query, Response
from app.services import ETL, variants, graph
import zstandard as zstd

router = APIRouter()

# ✅ تابع کمکی برای تبدیل DataFrame به بایت‌های Arrow
def df_to_arrow_bytes(df: pl.DataFrame) -> bytes:
    """Serializes a Polars DataFrame to Arrow IPC Stream bytes with zstd compression."""
    sink = io.BytesIO()
    # 🔥 Using LZ4 compression to reduce size (especially for nested list columns)
    df.write_ipc_stream(sink, compression=None)
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
    print("🌐 [API] POST /api/graph/data called (Optimized with Arrow + MsgPack)")
    # ... (print parameters can remain same) ...
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date) 
        print("✅ [API] Step 1: ETL complete.\n")
        
        # 2. Variants Calculation
        print("📦 [API] Step 2: Calculating variants...")
        # خروجی‌ها حالا DataFrame هستند (طبق تغییرات مرحله قبل)
        pareto_df, all_vars_df, start_nodes, end_nodes = variants.get_variants_logic(
            lf, target_coverage
        )
        print(f"✅ [API] Step 2: Variants complete. Pareto DF shape: {pareto_df.shape}\n")
        
        # 3. Graph Generation
        print("📦 [API] Step 3: Generating graph...")
        # نکته مهم: اینجا pareto_df (که DataFrame است) را پاس می‌دهیم
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
        
        # 4. Serialization & Packing (🔥 بخش اصلی بهینه‌سازی)
        print("📦 [API] Step 4: Serializing to Arrow IPC + MessagePack...")
        
        # Serialize DataFrames to Arrow IPC
        # Note: pareto_df is used internally for graph generation but NOT sent to frontend
        # Frontend can filter all_vars_df by cum_coverage if needed
        cctx = zstd.ZstdCompressor(level=3)
        graph_arrow = cctx.compress(df_to_arrow_bytes(graph_df))
        all_vars_arrow = cctx.compress(df_to_arrow_bytes(all_vars_df))
        
        print(f"   [DEBUG] graph_df Arrow size: {len(graph_arrow) / 1024:.2f} KB")
        print(f"   [DEBUG] all_vars_df Arrow size: {len(all_vars_arrow) / 1024:.2f} KB")
        
        payload = {
            "graphData_arrow": graph_arrow,
            "allVariants_arrow": all_vars_arrow,
            "startActivities": start_nodes,
            "endActivities": end_nodes,
            "targetCoverage": target_coverage,  # Send coverage threshold so frontend can filter if needed
        }

        packed_data = msgpack.packb(payload, use_bin_type=True)
        
        print(f"✅ [API] Serialization complete. Payload size: {len(packed_data) / 1024:.2f} KB")
        print("=" * 80)
        print("✅ [API] Request completed successfully!")
        print("=" * 80)
        
        return Response(content=packed_data, media_type="application/x-msgpack")

    except Exception as e:
        print("=" * 80)
        print(f"❌ [API] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 80)
        # در صورت خطا، بهتر است ارور استاندارد HTTP برگردانید
        raise e