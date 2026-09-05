"""
Tầng 2: Multi-Objective Utility Scoring – Tối Ưu Đa Mục Tiêu

Chấm điểm các ô hợp lệ theo 4 chiều chuẩn hóa [0, 100]:
  TotalScore(Bin_j) = w1·S_ABC + w2·S_Ergo + w3·S_Fill + w4·S_Affinity

Sử dụng NumPy vectorized operations cho hiệu năng tối đa.
"""

from __future__ import annotations
import numpy as np
from models import SKUProfile, BinCandidate, ScoringWeights, ABCClass


def score_abc(bins: list[BinCandidate], sku: SKUProfile) -> np.ndarray:
    """
    S_ABC – Điểm Tối Ưu Quãng Đường (Velocity vs Distance)

    - Hàng nhóm A (80% lượt xuất): Ưu tiên ô gần cửa xuất nhất
      S = 100 × (1 - D(bin,gate) / D_max)
    - Hàng nhóm C (5% lượt xuất): Ưu tiên ô xa cửa xuất (sâu/cao)
      S = 100 × (D(bin,gate) / D_max)
    - Hàng nhóm B: Ưu tiên vùng giữa
    """
    if not bins:
        return np.array([])

    distances = np.array([b.distance_to_gate for b in bins], dtype=np.float64)
    d_max = np.max(distances) if np.max(distances) > 0 else 1.0

    if sku.abc_class == ABCClass.A:
        # Gần cửa = điểm cao
        scores = 100.0 * (1.0 - distances / d_max)
    elif sku.abc_class == ABCClass.C:
        # Xa cửa = điểm cao (lưu kho sâu)
        scores = 100.0 * (distances / d_max)
    else:  # B
        # Ưu tiên vùng giữa (40-60% khoảng cách)
        mid = d_max * 0.5
        scores = 100.0 * (1.0 - np.abs(distances - mid) / d_max)

    return np.clip(scores, 0, 100)


def score_ergonomics(bins: list[BinCandidate], sku: SKUProfile) -> np.ndarray:
    """
    S_Ergo – Điểm Công Thái Học & Trọng Tâm Kệ

    - Hàng nặng (>25kg): Bắt buộc tầng 1-2 (đáy kệ) → 100 điểm
    - Hàng nhẹ (<5kg) nhóm A/B: Golden Zone (0.8m - 1.4m) → 100 điểm
    - Hàng nhẹ nhóm C: Tầng 4+ không sao → 60 điểm
    """
    if not bins:
        return np.array([])

    heights = np.array([b.height_from_ground for b in bins], dtype=np.float64)
    levels = np.array([b.shelf_level for b in bins], dtype=np.float64)
    scores = np.full(len(bins), 50.0)  # Default baseline

    weight = sku.weight

    if weight >= 25:
        # HÀNG NẶNG: Tầng đáy = an toàn tuyệt đối
        # Tầng 1 → 100, Tầng 2 → 85, Tầng 3 → 30, Tầng 4+ → 5
        scores = np.where(levels <= 1, 100.0,
                 np.where(levels <= 2, 85.0,
                 np.where(levels <= 3, 30.0, 5.0)))
    elif weight < 5:
        # HÀNG NHẸ: Golden Zone (0.8m - 1.4m) cho nhóm A/B
        golden_mask = (heights >= 0.8) & (heights <= 1.4)
        if sku.abc_class in (ABCClass.A, ABCClass.B):
            scores = np.where(golden_mask, 100.0,
                     np.where(heights < 0.8, 60.0,
                     np.where(heights <= 2.0, 70.0, 40.0)))
        else:  # Nhóm C nhẹ - tầng nào cũng OK
            scores = np.where(golden_mask, 70.0, 60.0)
    else:
        # HÀNG TRUNG BÌNH (5-25kg): Tầng 1-3 ưu tiên
        scores = np.where(levels <= 2, 90.0,
                 np.where(levels <= 3, 70.0,
                 np.where(levels <= 4, 45.0, 20.0)))

    return np.clip(scores, 0, 100)


def score_fill_rate(bins: list[BinCandidate], sku: SKUProfile) -> np.ndarray:
    """
    S_Fill – Điểm Lấp Đầy & Chống Phân Mảnh Không Gian

    Tránh tình trạng lãng phí ngăn lớn cho kiện hàng bé:
    S_Fill = 100 × (1 - |Vol_remaining - Vol_SKU| / Vol_capacity)
    """
    if not bins:
        return np.array([])

    incoming_vol = sku.dimensions.volume * sku.quantity
    capacities = np.array([b.max_volume for b in bins], dtype=np.float64)
    current_vols = np.array([b.current_volume for b in bins], dtype=np.float64)
    remaining = capacities - current_vols

    # Tránh division by zero
    safe_caps = np.where(capacities > 0, capacities, 1.0)

    scores = 100.0 * (1.0 - np.abs(remaining - incoming_vol) / safe_caps)

    return np.clip(scores, 0, 100)


def score_affinity(
    bins: list[BinCandidate],
    sku: SKUProfile,
    affinity_skus: list[str],
) -> np.ndarray:
    """
    S_Affinity – Điểm Gắn Kết Mua Kèm (Order Co-occurrence)

    Nếu SKU A và SKU B thường nằm chung đơn hàng xuất,
    AI ưu tiên xếp SKU B cùng rack/shelf với SKU A.
    """
    if not bins:
        return np.array([])

    if not affinity_skus:
        return np.full(len(bins), 50.0)  # Neutral score nếu không có data

    affinity_set = set(affinity_skus)
    scores = np.zeros(len(bins), dtype=np.float64)

    for i, b in enumerate(bins):
        if not b.stored_sku_ids:
            scores[i] = 50.0  # Ô trống = neutral
            continue

        # Đếm số SKU affinity đã có trong ô/kệ
        matches = sum(1 for s in b.stored_sku_ids if s in affinity_set)
        total_stored = len(b.stored_sku_ids)

        if matches > 0:
            # Có SKU mua chung → điểm cao
            scores[i] = min(70.0 + (matches / max(len(affinity_skus), 1)) * 30.0, 100.0)
        else:
            # Không có SKU mua chung → điểm trung bình
            scores[i] = max(50.0 - total_stored * 5, 10.0)

    return np.clip(scores, 0, 100)


def compute_total_score(
    bins: list[BinCandidate],
    sku: SKUProfile,
    weights: ScoringWeights,
    affinity_skus: list[str],
) -> tuple[np.ndarray, list[dict]]:
    """
    Tính tổng điểm trọng số cho tất cả bins.

    Returns:
        - total_scores: NumPy array tổng điểm [0-100]
        - breakdowns: List dict chứa chi tiết điểm từng thành phần
    """
    if not bins:
        return np.array([]), []

    s_abc = score_abc(bins, sku)
    s_ergo = score_ergonomics(bins, sku)
    s_fill = score_fill_rate(bins, sku)
    s_aff = score_affinity(bins, sku, affinity_skus)

    total = (
        weights.w_abc * s_abc
        + weights.w_ergo * s_ergo
        + weights.w_fill * s_fill
        + weights.w_affinity * s_aff
    )

    breakdowns = []
    for i in range(len(bins)):
        breakdowns.append({
            "s_abc": round(float(s_abc[i]), 1),
            "s_ergo": round(float(s_ergo[i]), 1),
            "s_fill": round(float(s_fill[i]), 1),
            "s_affinity": round(float(s_aff[i]), 1),
            "total": round(float(total[i]), 1),
        })

    return total, breakdowns
