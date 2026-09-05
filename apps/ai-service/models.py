"""
Pydantic Data Models cho AI Slotting Engine

Định nghĩa schemas cho request/response giữa NestJS Backend ↔ Python Engine.
"""

from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────

class ZoneType(str, Enum):
    COLD = "COLD"
    AMBIENT = "AMBIENT"
    THERMAL = "THERMAL"


class ABCClass(str, Enum):
    A = "A"
    B = "B"
    C = "C"


class BinStatus(str, Enum):
    EMPTY = "EMPTY"
    PARTIAL = "PARTIAL"
    FULL = "FULL"
    MAINTENANCE = "MAINTENANCE"


# ─── Input Models ─────────────────────────────────────

class Dimensions(BaseModel):
    """Kích thước 3D (cm)"""
    length: float = Field(ge=0, description="Chiều dài (cm)")
    width: float = Field(ge=0, description="Chiều rộng (cm)")
    height: float = Field(ge=0, description="Chiều cao (cm)")

    @property
    def volume(self) -> float:
        return self.length * self.width * self.height


class SKUProfile(BaseModel):
    """Thông tin sản phẩm cần cất hàng"""
    sku_id: str = Field(description="Mã sản phẩm")
    name: str = Field(default="", description="Tên sản phẩm")
    dimensions: Dimensions = Field(description="Kích thước bao bì L×W×H (cm)")
    weight: float = Field(ge=0, description="Trọng lượng (kg)")
    quantity: int = Field(ge=1, default=1, description="Số lượng kiện cần cất")
    required_zone_type: ZoneType = Field(default=ZoneType.AMBIENT, description="Yêu cầu bảo quản")
    abc_class: ABCClass = Field(default=ABCClass.C, description="Phân loại ABC")
    hazard_class: Optional[str] = Field(default=None, description="Phân loại nguy hiểm")


class ExistingItem(BaseModel):
    """Kiện hàng đã nằm trong bin"""
    sku_id: str
    dimensions: Dimensions
    position: tuple[float, float, float] = Field(default=(0, 0, 0), description="Tọa độ (x, y, z) trong bin")


class BinCandidate(BaseModel):
    """Thông tin ô chứa ứng viên"""
    code: str = Field(description="Mã vị trí: ZA-R01-S02-C05")
    zone: str = Field(description="Mã khu vực")
    rack: str = Field(description="Mã dãy kệ")
    shelf_level: int = Field(ge=1, description="Tầng kệ (1 = đáy)")
    cell: str = Field(default="", description="Mã ô")

    # Physical constraints
    zone_type: ZoneType = Field(default=ZoneType.AMBIENT, description="Loại khu vực bảo quản")
    max_weight: float = Field(ge=0, description="Tải trọng tối đa (kg)")
    current_weight: float = Field(ge=0, default=0, description="Tải trọng hiện tại (kg)")
    max_volume: float = Field(ge=0, description="Thể tích tối đa (cm³)")
    current_volume: float = Field(ge=0, default=0, description="Thể tích hiện tại (cm³)")
    bin_dimensions: Dimensions = Field(description="Kích thước ô chứa L×W×H (cm)")

    # Spatial info
    height_from_ground: float = Field(ge=0, default=0, description="Độ cao so với mặt sàn (m)")
    distance_to_gate: float = Field(ge=0, default=0, description="Khoảng cách tới cửa xuất (m)")

    # Status
    status: BinStatus = Field(default=BinStatus.EMPTY, description="Trạng thái ô")

    # Existing items (for 3D packing)
    existing_items: list[ExistingItem] = Field(default_factory=list, description="Kiện hàng đã có trong ô")

    # Affinity
    stored_sku_ids: list[str] = Field(default_factory=list, description="Danh sách SKU đang lưu trữ")


class ScoringWeights(BaseModel):
    """Trọng số điểm đa mục tiêu (tổng = 1.0)"""
    w_abc: float = Field(default=0.35, ge=0, le=1, description="Trọng số tối ưu khoảng cách")
    w_ergo: float = Field(default=0.25, ge=0, le=1, description="Trọng số công thái học")
    w_fill: float = Field(default=0.20, ge=0, le=1, description="Trọng số lấp đầy")
    w_affinity: float = Field(default=0.20, ge=0, le=1, description="Trọng số mua kèm")


class SlottingRequest(BaseModel):
    """Request gửi tới AI Engine để tìm vị trí cất hàng tối ưu"""
    sku_profile: SKUProfile
    candidate_bins: list[BinCandidate]
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    affinity_skus: list[str] = Field(default_factory=list, description="Danh sách SKU thường mua chung")
    max_results: int = Field(default=3, ge=1, le=10)


# ─── Output Models ────────────────────────────────────

class ScoreBreakdown(BaseModel):
    """Chi tiết điểm từng thành phần"""
    s_abc: float = Field(description="Điểm tối ưu khoảng cách (0-100)")
    s_ergo: float = Field(description="Điểm công thái học & an toàn (0-100)")
    s_fill: float = Field(description="Điểm lấp đầy & chống phân mảnh (0-100)")
    s_affinity: float = Field(description="Điểm gắn kết mua kèm (0-100)")
    total: float = Field(description="Tổng điểm trọng số (0-100)")


class BinRecommendation(BaseModel):
    """Một gợi ý vị trí cất hàng"""
    rank: int = Field(description="Thứ hạng gợi ý")
    bin_code: str = Field(description="Mã vị trí ô")
    zone: str
    rack: str
    shelf_level: int
    score: ScoreBreakdown
    explanation_tags: list[str] = Field(description="Danh sách giải trình XAI")
    fits_3d: bool = Field(default=True, description="Kết quả kiểm tra 3D packing")
    remaining_capacity_pct: float = Field(description="Dung lượng còn lại sau khi cất (%)")


class SlottingResponse(BaseModel):
    """Response từ AI Engine"""
    success: bool = True
    source: str = Field(default="AI_ENGINE", description="AI_ENGINE hoặc FALLBACK_HEURISTIC")
    sku_id: str
    recommendations: list[BinRecommendation]
    total_candidates: int = Field(description="Tổng ô ứng viên ban đầu")
    filtered_candidates: int = Field(description="Số ô qua bộ lọc Tầng 1")
    computation_ms: float = Field(description="Thời gian tính toán (ms)")


# ─── Re-slotting Models ───────────────────────────────

class InventoryItem(BaseModel):
    """Mục hàng hiện tại trong kho"""
    sku_id: str
    bin_code: str
    quantity: int
    weight: float
    dimensions: Dimensions
    abc_class: ABCClass = ABCClass.C


class ReSlottingRequest(BaseModel):
    """Request tái bố trí kho"""
    warehouse_id: str
    inventory_items: list[InventoryItem]
    available_bins: list[BinCandidate]
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    affinity_pairs: dict[str, list[str]] = Field(default_factory=dict, description="SKU → [SKU mua chung]")


class RelocationOrder(BaseModel):
    """Lệnh dời hàng"""
    sku_id: str
    from_bin: str
    to_bin: str
    quantity: int
    reason: str
    priority: int = Field(ge=1, le=10, default=5)
    improvement_score: float = Field(description="Cải thiện điểm bao nhiêu %")


class ReSlottingResponse(BaseModel):
    """Response tái bố trí"""
    success: bool = True
    warehouse_id: str
    relocation_orders: list[RelocationOrder]
    total_items_analyzed: int
    items_to_relocate: int
    estimated_improvement_pct: float = Field(description="% cải thiện hiệu suất ước tính")
    computation_ms: float
