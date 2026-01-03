from fastapi import APIRouter, Query, HTTPException
from app.services import ETL, searchCase

router = APIRouter()

@router.get("/search")
async def search_case_by_id(
    case_id: int = Query(..., description="The Case ID to search for"),
    start_date: str = Query(None),
    end_date: str = Query(None),
    include_global_stats: bool = Query(True, description="Include comparison with global statistics")
):
    """
    Search for a specific case by its ID and return its path and timing information.
    Optionally compares the case to global statistics.
    """
    print("=" * 80)
    print("🌐 [API] GET /api/search/search called")
    print(f"   [API] Parameters:")
    print(f"         case_id={case_id}")
    print(f"         start_date={start_date}, end_date={end_date}")
    print(f"         include_global_stats={include_global_stats}")
    print("=" * 80)
    
    try:
        # 1. ETL (Load + Filter + Enrich)
        print("\n📦 [API] Step 1: Running ETL pipeline...")
        lf = ETL.get_lazyframe(start_date, end_date)
        print("✅ [API] Step 1: ETL complete.\n")
        
        # 2. Get global context if needed
        df_global_context = None
        if include_global_stats:
            print("📦 [API] Step 2: Collecting global context for comparison...")
            df_global_context = lf.collect()
            print(f"✅ [API] Step 2: Global context collected. Shape: {df_global_context.shape}\n")
        
        # 3. Search for the case
        print(f"📦 [API] Step 3: Searching for case_id={case_id}...")
        result = searchCase.search_case_logic(lf, case_id, df_global_context)
        
        if result is None:
            print(f"⚠️ [API] Case {case_id} not found.")
            raise HTTPException(status_code=404, detail=f"Case with ID {case_id} not found")
        
        print(f"✅ [API] Step 3: Case found with {len(result['nodes'])} nodes.\n")
        
        print("=" * 80)
        print("✅ [API] Request completed successfully!")
        print("=" * 80)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print("=" * 80)
        print(f"❌ [API] ERROR: {type(e).__name__}: {e}")
        print("=" * 80)
        raise HTTPException(status_code=500, detail=str(e))
