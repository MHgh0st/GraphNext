from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import GraphData, SearchCase, Stats, Auth # Auth اضافه شد

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

# Auth Operations - /api/auth/* (این خط رو اضافه کن)
app.include_router(Auth.router, prefix="/api/auth", tags=["Authentication & Logging"])

@app.get("/")
def read_root():
    return {"Hello": "FastAPI is Working!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}