"""
Tầng 1: Hard Constraint Filtering – Lọc Ràng Buộc Cứng

Tất cả các ô chứa vi phạm một trong các điều kiện an toàn/vật lý
sẽ bị loại bỏ ngay lập tức (Score = 0).

Các ràng buộc:
  1. Zone type match (COLD/AMBIENT/THERMAL)
  2. Weight limit
  3. Volume limit (gross)
  4. Chemical/hazard compatibility
  5. Bin status (not FULL/MAINTENANCE)
"""

from __future__ import annotations
from models import SKUProfile, BinCandidate, BinStatus, ZoneType


# Bảng tương thích hóa chất – ngăn chặn cất hàng nguy hiểm cùng ô
INCOMPATIBLE_HAZARDS: dict[str, set[str]] = {
    "FLAMMABLE": {"OXIDIZER", "CORROSIVE", "FOOD"},
    "OXIDIZER": {"FLAMMABLE"},
    "CORROSIVE": {"FLAMMABLE", "FOOD"},
    "FOOD": {"FLAMMABLE", "CORROSIVE", "TOXIC"},
    "TOXIC": {"FOOD"},
}


def filter_by_zone_type(sku: SKUProfile, bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Ràng buộc Môi trường: Zone_SKU == Zone_Bin
    Hàng yêu cầu -18°C không được phép vào Kho thường.
    """
    return [b for b in bins if b.zone_type == sku.required_zone_type]


def filter_by_weight(sku: SKUProfile, bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Ràng buộc Tải trọng: currentWeight + incomingWeight ≤ maxWeight
    """
    incoming_weight = sku.weight * sku.quantity
    return [b for b in bins if (b.current_weight + incoming_weight) <= b.max_weight]


def filter_by_volume(sku: SKUProfile, bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Ràng buộc Thể tích thô: currentVolume + incomingVolume ≤ maxVolume
    """
    incoming_volume = sku.dimensions.volume * sku.quantity
    return [b for b in bins if (b.current_volume + incoming_volume) <= b.max_volume]


def filter_by_status(bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Loại bỏ ô đã đầy hoặc đang bảo trì.
    """
    return [b for b in bins if b.status not in (BinStatus.FULL, BinStatus.MAINTENANCE)]


def filter_by_compatibility(sku: SKUProfile, bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Ràng buộc Tương thích hóa chất & Chống nhiễm chéo:
    Hóa chất tẩy rửa không được cùng ngăn với thực phẩm.
    """
    if not sku.hazard_class:
        return bins

    hazard_upper = sku.hazard_class.upper()
    incompatible = INCOMPATIBLE_HAZARDS.get(hazard_upper, set())

    if not incompatible:
        return bins

    # Trong thực tế, kiểm tra hazard_class của các SKU đã lưu trong bin
    # Ở đây giả định stored_sku_ids chứa thông tin hazard (cần mở rộng)
    return bins  # Passthrough for now, extensible later


def apply_all_filters(sku: SKUProfile, bins: list[BinCandidate]) -> list[BinCandidate]:
    """
    Áp dụng tất cả bộ lọc ràng buộc cứng theo thứ tự.
    Nhanh nhất lọc trước (status) → chậm nhất lọc sau.
    """
    result = filter_by_status(bins)
    result = filter_by_zone_type(sku, result)
    result = filter_by_weight(sku, result)
    result = filter_by_volume(sku, result)
    result = filter_by_compatibility(sku, result)
    return result
