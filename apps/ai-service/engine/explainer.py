"""
Tầng 4: Explainable AI (XAI) – Giải Trình Minh Bạch

Thay vì là một "hộp đen", hệ thống cung cấp lý do minh bạch
cho mỗi gợi ý vị trí cất hàng:
  - Danh sách tags giải trình bằng tiếng Việt
  - Breakdown điểm chi tiết từng thành phần
  - Cảnh báo rủi ro nếu có
"""

from __future__ import annotations
from models import SKUProfile, BinCandidate, ABCClass


def generate_explanation_tags(
    score_breakdown: dict,
    sku: SKUProfile,
    bin_candidate: BinCandidate,
    fits_3d: bool,
) -> list[str]:
    """
    Tạo danh sách tags giải trình cho một gợi ý.

    Ví dụ output:
    [
        "✅ Hàng nhóm A đặt gần cửa xuất (12m) – Tối ưu quãng đường",
        "✅ Tầng đáy (Tầng 1) an toàn cho hàng 22kg",
        "📦 Tỷ lệ lấp đầy ô đạt 92% – Chống phân mảnh",
        "🔗 Cùng kệ với Gia vị, Nước mắm – Thường mua chung"
    ]
    """
    tags: list[str] = []

    # ─── ABC Distance ─────────────────────────────────
    s_abc = score_breakdown.get("s_abc", 0)
    distance = bin_candidate.distance_to_gate

    if sku.abc_class == ABCClass.A:
        if s_abc >= 80:
            tags.append(f"✅ Hàng nhóm A gần cửa xuất ({distance:.0f}m) – Tối ưu quãng đường lấy hàng")
        elif s_abc >= 50:
            tags.append(f"⚠️ Hàng nhóm A cách cửa xuất {distance:.0f}m – Chưa tối ưu nhưng chấp nhận được")
        else:
            tags.append(f"❌ Hàng nhóm A đặt quá xa cửa xuất ({distance:.0f}m) – Tốn thời gian lấy hàng")
    elif sku.abc_class == ABCClass.C:
        if s_abc >= 60:
            tags.append(f"✅ Hàng nhóm C lưu kho sâu ({distance:.0f}m) – Tiết kiệm vị trí đắc địa cho hàng bán chạy")
        else:
            tags.append(f"ℹ️ Hàng nhóm C ở vị trí trung bình ({distance:.0f}m)")
    else:  # B
        tags.append(f"ℹ️ Hàng nhóm B vị trí vùng giữa ({distance:.0f}m) – Cân bằng tốt")

    # ─── Ergonomics ───────────────────────────────────
    s_ergo = score_breakdown.get("s_ergo", 0)
    level = bin_candidate.shelf_level
    height = bin_candidate.height_from_ground

    if sku.weight >= 25:
        if level <= 2:
            tags.append(f"✅ Tầng {level} (đáy kệ) an toàn cho hàng nặng {sku.weight:.1f}kg – Hạ trọng tâm kệ")
        else:
            tags.append(f"⚠️ Hàng {sku.weight:.1f}kg đặt Tầng {level} – Nguy cơ an toàn lao động!")
    elif sku.weight < 5 and sku.abc_class in (ABCClass.A, ABCClass.B):
        if 0.8 <= height <= 1.4:
            tags.append(f"✅ Golden Zone ({height:.1f}m) – Nhân viên lấy hàng không cần cúi/rướn người")
        else:
            tags.append(f"ℹ️ Tầng {level} ({height:.1f}m) – Ngoài Golden Zone nhưng chấp nhận được")
    else:
        if level <= 3:
            tags.append(f"✅ Tầng {level} phù hợp cho hàng {sku.weight:.1f}kg")

    # ─── Fill Rate ────────────────────────────────────
    s_fill = score_breakdown.get("s_fill", 0)
    incoming_vol = sku.dimensions.volume * sku.quantity
    remaining = max(bin_candidate.max_volume - bin_candidate.current_volume, 0)
    fill_after = 0.0
    if bin_candidate.max_volume > 0:
        fill_after = ((bin_candidate.current_volume + incoming_vol) / bin_candidate.max_volume) * 100

    if s_fill >= 80:
        tags.append(f"📦 Lấp đầy ô {fill_after:.0f}% sau khi cất – Sử dụng không gian hiệu quả")
    elif s_fill >= 50:
        tags.append(f"📦 Lấp đầy ô {fill_after:.0f}% – Dung lượng vừa phải")
    else:
        tags.append(f"⚠️ Ô quá lớn cho kiện hàng – Tỷ lệ lấp đầy chỉ {fill_after:.0f}% (phân mảnh không gian)")

    # ─── Affinity ─────────────────────────────────────
    s_aff = score_breakdown.get("s_affinity", 0)
    if s_aff >= 70:
        tags.append("🔗 Cùng kệ với sản phẩm thường được mua chung – Tăng tốc lấy hàng đơn")
    elif s_aff >= 50:
        tags.append("ℹ️ Vị trí trung lập về mua kèm")

    # ─── 3D Packing ───────────────────────────────────
    if fits_3d:
        tags.append("✅ Kiểm tra hình học 3D: Kiện hàng xếp vừa kích thước ô")
    else:
        tags.append("❌ Kiểm tra hình học 3D: Kiện hàng KHÔNG xếp vừa dù thể tích đủ")

    return tags


def generate_overall_verdict(total_score: float) -> str:
    """Tạo nhãn đánh giá tổng quan."""
    if total_score >= 90:
        return "🏆 ĐỀ XUẤT TỐI ƯU – Best Choice"
    elif total_score >= 75:
        return "✅ ĐỀ XUẤT TỐT – Good Choice"
    elif total_score >= 50:
        return "⚠️ CHẤP NHẬN ĐƯỢC – Acceptable"
    elif total_score >= 30:
        return "⚠️ DƯỚI TRUNG BÌNH – Below Average"
    else:
        return "❌ KHÔNG KHUYẾN NGHỊ – Not Recommended"
