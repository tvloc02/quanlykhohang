"""
Smart WMS – AI Slotting Engine (FastAPI Microservice)

Microservice Python độc lập cung cấp khả năng tối ưu hóa vị trí cất hàng
bằng kiến trúc 4 tầng: Hard Constraints → Multi-Objective Scoring → 3D Packing → XAI.

Chạy: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router

app = FastAPI(
    title="Smart WMS – AI Slotting Engine",
    description=(
        "Microservice Python cho tính năng AI Slotting Optimization.\n\n"
        "**Kiến trúc 4 tầng:**\n"
        "- Tầng 1: Hard Constraint Filtering (Lọc ràng buộc cứng)\n"
        "- Tầng 2: Multi-Objective Utility Scoring (NumPy vectorized)\n"
        "- Tầng 3: 3D Geometric Bin Packing (Extreme Point Heuristic)\n"
        "- Tầng 4: Explainable AI & Human-in-the-loop (XAI)\n"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS cho NestJS Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to NestJS backend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(router)


@app.get("/")
async def root():
    return {
        "service": "Smart WMS AI Slotting Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/engine/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, workers=1)
