from fastapi import APIRouter, HTTPException
from app.schemas import GraphDataInput, CalculationResult
from app.services.math_engine import calculate_stats

router = APIRouter()

@router.post("/analyze", response_model=CalculationResult)
def analyze_graph(payload: GraphDataInput):
    """
    این تابع:
    1. داده‌ها را طبق `GraphDataInput` چک می‌کند.
    2. اگر فرمت درست بود، به سرویس ریاضی می‌فرستد.
    3. جواب را برمی‌گرداند.
    """
    
    # اگر لیست خالی بود ارور بده
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="List cannot be empty")

    # صدا زدن سرویس ریاضی (لایه Logic)
    stats = calculate_stats(payload.nodes)

    # بازگرداندن خروجی طبق `CalculationResult`
    return {
        "mean": stats["mean"],
        "std_dev": stats["std_dev"],
        "message": f"Analysis complete for {payload.label}"
    }