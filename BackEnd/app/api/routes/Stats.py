from fastapi import APIRouter, Query, HTTPException
from app.services import ETL, stats

router = APIRouter()

@router.get("/global")
async def get_global_stats(
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """
    Get global statistics for all cases including:
    - Total duration distribution histogram
    - Case length (steps) distribution histogram
    """
    print("=" * 80)
    print("🌐 [API] GET /api/stats/global called")
    print(f"   [API] Parameters:")
    print(f"         start_date={start_date}, end_date={end_date}")
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date)
        print("✅ [API] Step 1: ETL complete.\n")
        
        # 2. Collect DataFrame
        print("📦 [API] Step 2: Collecting DataFrame...")
        df = lf.collect()
        print(f"✅ [API] Step 2: DataFrame collected. Shape: {df.shape}\n")
        
        # 3. Calculate global statistics
        print("📦 [API] Step 3: Calculating global statistics...")
        result = stats.get_global_statistics(df)
        print(f"✅ [API] Step 3: Statistics calculated.")
        print(f"   [API] Duration histogram bins: {len(result['total_time']['bins'])}")
        print(f"   [API] Steps histogram bins: {len(result['steps']['bins'])}\n")
        
        print("=" * 80)
        print("✅ [API] Request completed successfully!")
        print("=" * 80)
        
        return result
        
    except Exception as e:
        print("=" * 80)
        print(f"❌ [API] ERROR: {type(e).__name__}: {e}")
        print("=" * 80)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/edge")
async def get_edge_stats(
    source: str = Query(..., description="Source activity name"),
    target: str = Query(..., description="Target activity name"),
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """
    Get duration distribution statistics for a specific edge (transition between two activities).
    Returns histogram data for the edge's duration distribution.
    """
    print("=" * 80)
    print("🌐 [API] GET /api/stats/edge called")
    print(f"   [API] Parameters:")
    print(f"         source={source}, target={target}")
    print(f"         start_date={start_date}, end_date={end_date}")
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date)
        print("✅ [API] Step 1: ETL complete.\n")
        
        # 2. Collect DataFrame
        print("📦 [API] Step 2: Collecting DataFrame...")
        df = lf.collect()
        print(f"✅ [API] Step 2: DataFrame collected. Shape: {df.shape}\n")
        
        # 3. Calculate edge statistics
        print(f"📦 [API] Step 3: Calculating statistics for edge '{source}' -> '{target}'...")
        result = stats.get_single_edge_statistics(df, source, target)
        print(f"✅ [API] Step 3: Edge statistics calculated.")
        print(f"   [API] Histogram bins: {len(result['bins'])}\n")
        
        if not result['bins']:
            print(f"⚠️ [API] No data found for edge '{source}' -> '{target}'")
        
        print("=" * 80)
        print("✅ [API] Request completed successfully!")
        print("=" * 80)
        
        return {
            "source": source,
            "target": target,
            "histogram": result
        }
        
    except Exception as e:
        print("=" * 80)
        print(f"❌ [API] ERROR: {type(e).__name__}: {e}")
        print("=" * 80)
        raise HTTPException(status_code=500, detail=str(e))
