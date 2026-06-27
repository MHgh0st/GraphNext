from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from app.config import DATABASE_URL
from app.api.routes import GraphData, SearchCase, Stats, Auth

app = FastAPI(
    title="Process Mining Graph API",
    description="API for process mining, graph generation, and case analytics",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Graph Operations - /api/graph/*
app.include_router(GraphData.router, prefix="/api/graph", tags=["Graph Operations"])

# Case Search - /api/search/*
app.include_router(SearchCase.router, prefix="/api", tags=["Case Search"])

# Statistics - /api/stats/*
app.include_router(Stats.router, prefix="/api/stats", tags=["Statistics"])

# Auth Operations - /api/auth/*
app.include_router(Auth.router, prefix="/api/auth", tags=["Authentication & Logging"])

@app.get("/")
def read_root():
    return {"Hello": "FastAPI is Working!"}

@app.get("/health")
def health_check():
    db_status = "healthy"
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=2)
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.close()
    except Exception as e:
        print(f"Database health check failed: {e}")
        db_status = "unhealthy"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "frontend": "healthy",
        "backend": "healthy",
        "database": db_status
    }