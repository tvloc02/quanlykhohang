"""
FastAPI Routes – API Endpoints cho AI Slotting Engine

Endpoints:
  POST /engine/solve      – Realtime Inbound Slotting (< 100ms target)
  POST /engine/re-slot    – Dynamic Re-slotting (batch, minutes)
  GET  /engine/health     – Health check + version
  GET  /engine/config     – Xem trọng số scoring hiện tại
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from models import (
    SlottingRequest, SlottingResponse,
    ReSlottingRequest, ReSlottingResponse,
    BatchSlottingRequest, BatchSlottingResponse,
    ScoringWeights,
)
from engine.solver import solve_slotting, solve_reslotting, solve_batch_slotting

router = APIRouter(prefix="/engine", tags=["AI Slotting Engine"])

ENGINE_VERSION = "1.1.0"
ENGINE_NAME = "Smart WMS AI Slotting Engine"


@router.post("/solve", response_model=SlottingResponse)
async def solve_endpoint(request: SlottingRequest) -> SlottingResponse:
    """
    Realtime Inbound Slotting – Tìm vị trí cất hàng tối ưu cho 1 SKU.

    Pipeline 4 tầng:
      1. Hard Constraint Filtering
      2. Multi-Objective Scoring (NumPy)
      3. 3D Geometric Packing
      4. Explainable AI (XAI)

    Target: < 100ms response time.
    """
    try:
        result = solve_slotting(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")


@router.post("/solve-batch", response_model=BatchSlottingResponse)
async def solve_batch_endpoint(request: BatchSlottingRequest) -> BatchSlottingResponse:
    """
    Multi-SKU Batch Slotting – Tối ưu hóa cất hàng đồng thời cho nhiều SKU.

    Tính năng nâng cao:
      1. Sắp xếp thứ tự ưu tiên (Priority & FFD)
      2. Giữ chỗ ảo (Shadow Reservation) tránh va chạm/quá tải ô
      3. Tự động phân tách lô (Auto-splitting Quantity)
      4. Gom cụm tương quan mua kèm (Affinity Clustering)
    """
    try:
        result = solve_batch_slotting(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch engine error: {str(e)}")


@router.post("/re-slot", response_model=ReSlottingResponse)
async def reslot_endpoint(request: ReSlottingRequest) -> ReSlottingResponse:
    """
    Dynamic Re-slotting – Tái bố trí toàn bộ kho.

    Phân tích lịch sử và đề xuất dời hàng để tối ưu.
    Chạy qua BullMQ queue trong giờ thấp điểm.
    """
    try:
        result = solve_reslotting(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-slotting error: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint cho NestJS client kiểm tra."""
    return {
        "status": "healthy",
        "engine": ENGINE_NAME,
        "version": ENGINE_VERSION,
        "capabilities": [
            "realtime_inbound_slotting",
            "dynamic_reslotting",
            "4_tier_optimization",
            "3d_bin_packing",
            "explainable_ai",
        ],
    }


@router.get("/config")
async def get_config():
    """Xem cấu hình trọng số scoring mặc định."""
    defaults = ScoringWeights()
    return {
        "scoring_weights": {
            "w_abc": defaults.w_abc,
            "w_ergo": defaults.w_ergo,
            "w_fill": defaults.w_fill,
            "w_affinity": defaults.w_affinity,
        },
        "description": {
            "w_abc": "Trọng số tối ưu khoảng cách (Velocity vs Distance)",
            "w_ergo": "Trọng số công thái học & an toàn lao động",
            "w_fill": "Trọng số lấp đầy & chống phân mảnh",
            "w_affinity": "Trọng số gắn kết mua kèm (Co-occurrence)",
        },
    }
