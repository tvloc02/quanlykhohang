"""
Tầng 3: 3D Geometric Bin Packing – Xác Thực Hình Học 3D

Ngay cả khi thể tích còn trống đủ lớn, một thùng hàng dài 2m
vẫn không thể xếp vừa ngăn vuông 1m × 1m × 1m.

Sử dụng Extreme Point Heuristic để:
  - Thử 6 rotation orientations (L×W×H permutations)
  - Tìm điểm đặt tọa độ cụ thể không chồng chéo
"""

from __future__ import annotations
from itertools import permutations
from models import Dimensions, BinCandidate, ExistingItem


# 6 phép xoay hướng kiện hàng (hoán vị L, W, H)
def get_orientations(dims: Dimensions) -> list[tuple[float, float, float]]:
    """
    Trả về tối đa 6 orientation (L, W, H) bằng hoán vị.
    Loại bỏ duplicate nếu các chiều bằng nhau.
    """
    values = (dims.length, dims.width, dims.height)
    unique = set(permutations(values))
    return list(unique)


def boxes_overlap(
    pos_a: tuple[float, float, float], dims_a: tuple[float, float, float],
    pos_b: tuple[float, float, float], dims_b: tuple[float, float, float],
) -> bool:
    """
    Kiểm tra 2 hộp 3D có chồng chéo nhau không.
    Sử dụng Separating Axis Theorem đơn giản cho AABB.
    """
    for axis in range(3):
        if (pos_a[axis] + dims_a[axis] <= pos_b[axis]) or \
           (pos_b[axis] + dims_b[axis] <= pos_a[axis]):
            return False
    return True


def fits_in_bin(
    item_dims: tuple[float, float, float],
    position: tuple[float, float, float],
    bin_dims: Dimensions,
) -> bool:
    """
    Kiểm tra kiện hàng tại vị trí position có nằm gọn trong bin không.
    """
    return (
        position[0] + item_dims[0] <= bin_dims.length
        and position[1] + item_dims[1] <= bin_dims.width
        and position[2] + item_dims[2] <= bin_dims.height
    )


def generate_extreme_points(
    existing_items: list[tuple[tuple[float, float, float], tuple[float, float, float]]],
    bin_dims: Dimensions,
) -> list[tuple[float, float, float]]:
    """
    Extreme Point Heuristic: Sinh các điểm đặt tiềm năng
    dựa trên các góc của kiện hàng đã có.

    Bắt đầu từ gốc (0, 0, 0), sau đó thêm các điểm
    tại các cạnh trên/phải/trước của mỗi kiện hàng.
    """
    points: list[tuple[float, float, float]] = [(0.0, 0.0, 0.0)]

    for pos, dims in existing_items:
        # Điểm bên phải
        p_right = (pos[0] + dims[0], pos[1], pos[2])
        # Điểm phía trước
        p_front = (pos[0], pos[1] + dims[1], pos[2])
        # Điểm phía trên
        p_top = (pos[0], pos[1], pos[2] + dims[2])

        for p in [p_right, p_front, p_top]:
            if (
                0 <= p[0] < bin_dims.length
                and 0 <= p[1] < bin_dims.width
                and 0 <= p[2] < bin_dims.height
            ):
                points.append(p)

    return points


def verify_3d_fit(
    sku_dims: Dimensions,
    bin_candidate: BinCandidate,
    quantity: int = 1,
) -> tuple[bool, str]:
    """
    Kiểm tra SKU có thể xếp vừa vào bin không (cả 3D geometry).

    Returns:
        (fits: bool, detail: str)
    """
    bin_dims = bin_candidate.bin_dimensions

    # Quick check: Nếu bin trống và 1 kiện hàng
    if not bin_candidate.existing_items and quantity == 1:
        orientations = get_orientations(sku_dims)
        for orient in orientations:
            if (
                orient[0] <= bin_dims.length
                and orient[1] <= bin_dims.width
                and orient[2] <= bin_dims.height
            ):
                return True, f"Xếp vừa với hướng {orient[0]:.0f}×{orient[1]:.0f}×{orient[2]:.0f}cm"
        return False, "Không có hướng xoay nào vừa kích thước ô chứa"

    # Complex case: Có kiện hàng sẵn hoặc nhiều kiện
    existing_packed: list[tuple[tuple[float, float, float], tuple[float, float, float]]] = []

    for item in bin_candidate.existing_items:
        item_dims = (item.dimensions.length, item.dimensions.width, item.dimensions.height)
        existing_packed.append((item.position, item_dims))

    orientations = get_orientations(sku_dims)
    placed_count = 0

    for _ in range(quantity):
        placed = False
        extreme_points = generate_extreme_points(existing_packed, bin_dims)

        for point in extreme_points:
            for orient in orientations:
                if not fits_in_bin(orient, point, bin_dims):
                    continue

                # Kiểm tra không chồng chéo với kiện hàng đã có
                overlap = False
                for existing_pos, existing_dims in existing_packed:
                    if boxes_overlap(point, orient, existing_pos, existing_dims):
                        overlap = True
                        break

                if not overlap:
                    existing_packed.append((point, orient))
                    placed_count += 1
                    placed = True
                    break

            if placed:
                break

        if not placed:
            break

    if placed_count >= quantity:
        return True, f"Xếp vừa {placed_count}/{quantity} kiện với 3D packing"
    elif placed_count > 0:
        return False, f"Chỉ xếp được {placed_count}/{quantity} kiện"
    else:
        return False, "Không thể xếp vào ô do không gian 3D không đủ"
