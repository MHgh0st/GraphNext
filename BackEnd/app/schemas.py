from pydantic import BaseModel, Field
from typing import List, Optional, Any

class GetVariantsRequest(BaseModel):
    # منبع داده (نام جدول دیتابیس یا اسم فایل)
    input_source: str = Field(..., description="Name of the table or file to analyze", example="my_graph_data")
    
    # فیلترهای اختیاری
    # start_date: Optional[str] = Field(None, description="Start date filter (YYYY-MM-DD)")
    # end_date: Optional[str] = Field(None, description="End date filter (YYYY-MM-DD)")
    
    # تنظیمات الگوریتم واریانت
    min_cases: Optional[int] = Field(None, description="Minimum frequency to keep a variant", example=1)
    target_coverage: float = Field(0.95, description="Pareto coverage threshold (0.0 to 1.0)", ge=0.0, le=1.0)

class VariantStats(BaseModel):
    # مسیر واریانت (لیست فعالیت‌ها)
    Variant_Path: List[str]
    
    # آمارهای عددی
    Frequency: int
    Percentage: float
    cum_coverage: float
    
    # شمارش شروع و پایان صحیح
    True_Start_Count: int
    True_End_Count: int
    
    # زمان‌ها (لیستی از اعداد که میانگین یا مجموع زمان در هر مرحله هستند)
    # نکته: چون در کد شما output.to_dicts() استفاده شده، Polars لیست‌ها را به لیست پایتون تبدیل می‌کند
    Avg_Timings: List[float]   
    Total_Timings: List[float]

    # تنظیمات اضافی برای اینکه دیکشنری Polars را راحت قبول کند
    class Config:
        populate_by_name = True


class GetVariantsResponse(BaseModel):
    # لیست واریانت‌های پارتو (مهم‌ها)
    pareto_variants: List[VariantStats]
    
    # لیست تمام واریانت‌ها (درخواست شما)
    all_variants: List[VariantStats]
    
    # نودهای مهم
    final_start_nodes: List[str]
    final_end_nodes: List[str]
    
    # پیام وضعیت (اختیاری)
    message: str = "Analysis completed successfully"