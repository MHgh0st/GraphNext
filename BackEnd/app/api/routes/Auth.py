from fastapi import APIRouter, Request, BackgroundTasks
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

router = APIRouter()

# Schema for incoming log request
class LoginLogRequest(BaseModel):
    phone_number: str = Field(..., description="The phone number of the logged-in user")
    user_id: Optional[str] = Field(None, description="External user ID if available")

# متغیری برای شبیه‌سازی دیتابیس (تا زمانی که خودت به دیتابیس اصلی وصلش کنی)
MOCK_LOGIN_LOGS_DB = []

def insert_log_to_db(log_entry: dict):
    """
    این تابع رو بعدا با کدهای ORM خودت (مثل SQLAlchemy) جایگزین کن
    """
    MOCK_LOGIN_LOGS_DB.append(log_entry)
    # برای تست توی کنسول چاپ میکنیم
    print(f"--- [NEW LOGIN SAVED TO DB] --- : {log_entry}")

@router.post("/log-login", summary="Log a successful user login")
async def log_user_login(
    data: LoginLogRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    # جمع‌آوری دیتاهایی که برای ذخیره در دیتابیس نیاز داری
    log_entry = {
        "phone_number": data.phone_number,
        "user_id": data.user_id,
        "ip_address": request.client.host if request.client else "Unknown",
        "user_agent": request.headers.get("user-agent", "Unknown"),
        "login_timestamp": datetime.utcnow().isoformat()
    }

    # استفاده از BackgroundTasks باعث میشه ای‌پی‌آی منتظر ذخیره شدن تو دیتابیس نمونه
    # و سریع به فرانت اند ریسپانس بده (برای پرفورمنس بهتر)
    background_tasks.add_task(insert_log_to_db, log_entry)

    return {"status": "success", "message": "Login activity logged successfully."}