from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import graph
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router, prefix="/api/v1/graph", tags=["Graph Operations"])

@app.get("/")
def read_root():
    return {"Hello": "FastAPI is Working!"}
