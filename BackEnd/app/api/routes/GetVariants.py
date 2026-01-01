from fastapi import APIRouter, HTTPException
from app.services.load_data import load_data_from_db
from app.services.GenerateVariants import get_variants


router = APIRouter()

@router.post("/get_variants", response_model=CalculationResult)