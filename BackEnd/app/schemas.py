from pydantic import BaseModel
from typing import List

# 1. مدل ورودی (آنچه کاربر می‌فرستد)
class GraphDataInput(BaseModel):
    nodes: List[float] 
    label: str

# 2. مدل خروجی (آنچه به کاربر برمی‌گردانیم)
class CalculationResult(BaseModel):
    mean: float
    std_dev: float
    message: str