"""
Engine Solver – Orchestrator điều phối Pipeline 4 tầng

Quy trình:
  1. Hard Constraint Filtering → candidate bins
  2. Multi-Objective Scoring → ranked bins (top N)
  3. 3D Packing Verification → verified bins
  4. Explainable AI → final recommendations (top 3)
"""

from __future__ import annotations
import time
from typing import Any, Optional
import numpy as np

from models import (
    SlottingRequest, SlottingResponse, BinRecommendation, ScoreBreakdown,
    ReSlottingRequest, ReSlottingResponse, RelocationOrder,
    BatchSlottingRequest, BatchSlottingResponse, BatchSlottingAllocation,
    AllocatedBin, BatchSlottingItem, ExistingItem, BinCandidate, ZoneType, ABCClass,
)
from engine.constraints import apply_all_filters
from engine.scoring import compute_total_score
from engine.packing import verify_3d_fit
from engine.explainer import generate_explanation_tags, generate_overall_verdict


def solve_slotting(request: SlottingRequest) -> SlottingResponse:
    """
    Pipeline chính: Tìm vị trí cất hàng tối ưu cho 1 SKU.
    Target: < 100ms cho realtime inbound slotting.
    """
    start_time = time.perf_counter()

    sku = request.sku_profile
    total_candidates = len(request.candidate_bins)

    # ─── TẦNG 1: Hard Constraint Filtering ────────────
    valid_bins = apply_all_filters(sku, request.candidate_bins)
    filtered_count = len(valid_bins)

    if not valid_bins:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return SlottingResponse(
            success=True,
            sku_id=sku.sku_id,
            recommendations=[],
            total_candidates=total_candidates,
            filtered_candidates=0,
            computation_ms=round(elapsed_ms, 2),
        )

    # ─── TẦNG 2: Multi-Objective Scoring ──────────────
    total_scores, breakdowns = compute_total_score(
        valid_bins, sku, request.scoring_weights, request.affinity_skus,
    )

    # Lấy top N ứng viên điểm cao nhất (trước khi verify 3D)
    top_n = min(request.max_results * 2, len(valid_bins))  # Lấy gấp đôi để dự phòng 3D fail
    top_indices = np.argsort(total_scores)[::-1][:top_n]

    # ─── TẦNG 3: 3D Geometric Verification ────────────
    recommendations: list[BinRecommendation] = []
    rank = 0

    for idx in top_indices:
        if rank >= request.max_results:
            break

        bin_candidate = valid_bins[int(idx)]
        breakdown = breakdowns[int(idx)]

        fits, packing_detail = verify_3d_fit(
            sku.dimensions, bin_candidate, sku.quantity,
        )

        # ─── TẦNG 4: Explainable AI ──────────────────
        explanation_tags = generate_explanation_tags(
            breakdown, sku, bin_candidate, fits,
        )
        verdict = generate_overall_verdict(breakdown["total"])
        explanation_tags.insert(0, verdict)

        # Tính remaining capacity
        incoming_vol = sku.dimensions.volume * sku.quantity
        remaining_pct = 0.0
        if bin_candidate.max_volume > 0:
            used_after = bin_candidate.current_volume + incoming_vol
            remaining_pct = max(0, ((bin_candidate.max_volume - used_after) / bin_candidate.max_volume) * 100)

        rank += 1
        recommendations.append(BinRecommendation(
            rank=rank,
            bin_code=bin_candidate.code,
            zone=bin_candidate.zone,
            rack=bin_candidate.rack,
            shelf_level=bin_candidate.shelf_level,
            score=ScoreBreakdown(
                s_abc=breakdown["s_abc"],
                s_ergo=breakdown["s_ergo"],
                s_fill=breakdown["s_fill"],
                s_affinity=breakdown["s_affinity"],
                total=breakdown["total"],
            ),
            explanation_tags=explanation_tags,
            fits_3d=fits,
            remaining_capacity_pct=round(remaining_pct, 1),
        ))

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    return SlottingResponse(
        success=True,
        sku_id=sku.sku_id,
        recommendations=recommendations,
        total_candidates=total_candidates,
        filtered_candidates=filtered_count,
        computation_ms=round(elapsed_ms, 2),
    )


def solve_reslotting(request: ReSlottingRequest) -> ReSlottingResponse:
    """
    Dynamic Re-slotting: Phân tích toàn bộ kho và đề xuất dời hàng.
    Chạy batch, có thể mất vài giây đến vài phút.
    """
    start_time = time.perf_counter()

    relocation_orders: list[RelocationOrder] = []
    total_items = len(request.inventory_items)

    # Tạo map bin_code → BinCandidate
    bin_map = {b.code: b for b in request.available_bins}

    for item in request.inventory_items:
        current_bin = bin_map.get(item.bin_code)
        if not current_bin:
            continue

        # Tạo slotting request cho item này
        from models import SlottingRequest as SR, ScoringWeights as SW
        sub_request = SR(
            sku_profile=models_item_to_sku(item),
            candidate_bins=[b for b in request.available_bins if b.code != item.bin_code],
            scoring_weights=request.scoring_weights,
            affinity_skus=request.affinity_pairs.get(item.sku_id, []),
            max_results=1,
        )

        result = solve_slotting(sub_request)
        if not result.recommendations:
            continue

        best = result.recommendations[0]

        # Chỉ đề xuất dời nếu cải thiện > 10%
        current_score = _estimate_current_score(item, current_bin, request)
        improvement = best.score.total - current_score

        if improvement > 10:
            relocation_orders.append(RelocationOrder(
                sku_id=item.sku_id,
                from_bin=item.bin_code,
                to_bin=best.bin_code,
                quantity=item.quantity,
                reason=best.explanation_tags[0] if best.explanation_tags else "Cải thiện hiệu suất",
                priority=1 if improvement > 30 else 5,
                improvement_score=round(improvement, 1),
            ))

    # Sort by improvement (cao → thấp)
    relocation_orders.sort(key=lambda x: x.improvement_score, reverse=True)

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    avg_improvement = 0.0
    if relocation_orders:
        avg_improvement = sum(r.improvement_score for r in relocation_orders) / len(relocation_orders)

    return ReSlottingResponse(
        success=True,
        warehouse_id=request.warehouse_id,
        relocation_orders=relocation_orders,
        total_items_analyzed=total_items,
        items_to_relocate=len(relocation_orders),
        estimated_improvement_pct=round(avg_improvement, 1),
        computation_ms=round(elapsed_ms, 2),
    )


def models_item_to_sku(item):
    """Convert InventoryItem → SKUProfile for sub-request."""
    from models import SKUProfile, ZoneType
    return SKUProfile(
        sku_id=item.sku_id,
        dimensions=item.dimensions,
        weight=item.weight,
        quantity=item.quantity,
        abc_class=item.abc_class,
        required_zone_type=ZoneType.AMBIENT,
    )


def _estimate_current_score(item, current_bin, request) -> float:
    """Ước tính điểm hiện tại của item tại bin hiện tại."""
    from engine.scoring import compute_total_score
    sku = models_item_to_sku(item)
    affinity_skus = request.affinity_pairs.get(item.sku_id, [])
    scores, breakdowns = compute_total_score(
        [current_bin], sku, request.scoring_weights, affinity_skus,
    )
    return float(scores[0]) if len(scores) > 0 else 50.0


# ─── Multi-SKU Batch Slotting ─────────────────────────

def _batch_item_priority(item: BatchSlottingItem):
    """Tính thứ tự ưu tiên sắp xếp cho từng SKU trong lô hàng."""
    p_override = item.priority_override if item.priority_override is not None else 99

    # Phân vùng nhiệt độ đặc biệt ưu tiên trước
    zone_order = 2
    if item.sku_profile.required_zone_type == ZoneType.COLD:
        zone_order = 0
    elif item.sku_profile.required_zone_type == ZoneType.THERMAL:
        zone_order = 1

    # ABC Velocity: A ưu tiên trước để lấy Golden Zone
    abc_order = 2
    if item.sku_profile.abc_class == ABCClass.A:
        abc_order = 0
    elif item.sku_profile.abc_class == ABCClass.B:
        abc_order = 1

    # Trọng lượng & Thể tích giảm dần (FFD Heuristic)
    unit_vol = item.sku_profile.dimensions.volume
    tot_weight = item.sku_profile.weight * item.sku_profile.quantity
    tot_vol = unit_vol * item.sku_profile.quantity

    return (p_override, zone_order, abc_order, -tot_weight, -tot_vol)


def solve_batch_slotting(request: BatchSlottingRequest) -> BatchSlottingResponse:
    """
    Multi-SKU Batch Slotting Pipeline:
      1. Sắp xếp thứ tự ưu tiên (Zone đặc biệt -> ABC Velocity -> FFD Heavy/Bulky).
      2. Giữ chỗ ảo (Shadow Reservation) cập nhật liên tục dung tích ô trong bộ nhớ.
      3. Tự động phân tách lô (Auto-splitting) khi số lượng vượt dung tích 1 ô.
      4. Gom cụm sản phẩm có liên quan mua kèm (Affinity / Co-occurrence).
    """
    start_time = time.perf_counter()

    # 1. Tạo shadow state mutable cho các ô
    shadow_bins: dict[str, Any] = {
        b.code: b.model_copy(deep=True) for b in request.candidate_bins
    }

    # 2. Sắp xếp danh sách mặt hàng theo độ ưu tiên
    sorted_items = sorted(request.items, key=_batch_item_priority)

    allocations: list[BatchSlottingAllocation] = []
    utilized_bin_codes: set[str] = set()
    total_units_requested = sum(it.sku_profile.quantity for it in request.items)
    total_units_allocated = 0
    fully_allocated_count = 0

    # 3. Phân bổ từng sản phẩm theo chuỗi giữ chỗ ảo
    for batch_item in sorted_items:
        sku = batch_item.sku_profile
        orig_qty = sku.quantity
        rem_qty = orig_qty
        allocated_bins: list[AllocatedBin] = []

        # Ghép danh sách affinity skus với các sku đã được xếp trong batch
        effective_affinity = list(set(batch_item.affinity_skus))

        while rem_qty > 0:
            # Lọc các ô còn khả năng tiếp nhận ít nhất 1 đơn vị
            valid_candidates = []
            for b in shadow_bins.values():
                # Ràng buộc zone
                if b.zone_type != sku.required_zone_type:
                    continue
                # Ràng buộc tải trọng còn lại
                rem_w = b.max_weight - b.current_weight
                if rem_w < sku.weight:
                    continue
                # Ràng buộc thể tích còn lại
                unit_vol = sku.dimensions.volume
                rem_v = b.max_volume - b.current_volume
                if rem_v < unit_vol:
                    continue
                # Kích thước 1 chiều
                bd = b.bin_dimensions
                sd = sku.dimensions
                if not (sd.length <= bd.length and sd.width <= bd.width and sd.height <= bd.height):
                    # Kiểm tra xoay hướng cơ bản
                    dims_sorted_sku = sorted([sd.length, sd.width, sd.height])
                    dims_sorted_bin = sorted([bd.length, bd.width, bd.height])
                    if not all(s <= b for s, b in zip(dims_sorted_sku, dims_sorted_bin)):
                        continue

                valid_candidates.append(b)

            if not valid_candidates:
                # Hết ô phù hợp
                break

            # Tính điểm đa mục tiêu cho các ô hợp lệ
            scores, breakdowns = compute_total_score(
                valid_candidates, sku, request.scoring_weights, effective_affinity,
            )

            # Sắp xếp ứng viên theo điểm cao nhất
            ranked_indices = np.argsort(scores)[::-1]

            allocated_in_round = False

            for idx in ranked_indices:
                cand_bin = valid_candidates[int(idx)]
                breakdown = breakdowns[int(idx)]

                # Tính số lượng tối đa ô có thể nhận
                avail_w = cand_bin.max_weight - cand_bin.current_weight
                avail_v = cand_bin.max_volume - cand_bin.current_volume
                unit_vol = sku.dimensions.volume

                max_w_qty = int(avail_w // sku.weight) if sku.weight > 0 else 999999
                max_v_qty = int(avail_v // unit_vol) if unit_vol > 0 else 999999
                max_fitting = max(1, min(max_w_qty, max_v_qty))

                if not request.allow_split and max_fitting < rem_qty:
                    # Nếu không cho phép tách lô và ô này không đủ chứa hết, tìm ô khác
                    continue

                alloc_qty = min(rem_qty, max_fitting)

                # Kiểm tra 3D Geometric Packing
                fits_3d, _ = verify_3d_fit(sku.dimensions, cand_bin, alloc_qty)

                # Tạo explanation tags
                explanation_tags = generate_explanation_tags(
                    breakdown, sku, cand_bin, fits_3d,
                )
                verdict = generate_overall_verdict(breakdown["total"])
                explanation_tags.insert(0, verdict)

                if alloc_qty < orig_qty:
                    explanation_tags.append(
                        f"⚡ Phân tách lô: Xếp {alloc_qty}/{orig_qty} kiện vào ô này do giới hạn sức chứa",
                    )

                # Cập nhật Shadow Reservation của ô
                alloc_weight = sku.weight * alloc_qty
                alloc_volume = unit_vol * alloc_qty

                cand_bin.current_weight += alloc_weight
                cand_bin.current_volume += alloc_volume
                if sku.sku_id not in cand_bin.stored_sku_ids:
                    cand_bin.stored_sku_ids.append(sku.sku_id)
                cand_bin.existing_items.append(
                    ExistingItem(sku_id=sku.sku_id, dimensions=sku.dimensions, position=(0, 0, 0))
                )

                remaining_pct = 0.0
                if cand_bin.max_volume > 0:
                    remaining_pct = max(0, ((cand_bin.max_volume - cand_bin.current_volume) / cand_bin.max_volume) * 100)

                allocated_bins.append(AllocatedBin(
                    bin_code=cand_bin.code,
                    zone=cand_bin.zone,
                    rack=cand_bin.rack,
                    shelf_level=cand_bin.shelf_level,
                    allocated_quantity=alloc_qty,
                    score=ScoreBreakdown(
                        s_abc=breakdown["s_abc"],
                        s_ergo=breakdown["s_ergo"],
                        s_fill=breakdown["s_fill"],
                        s_affinity=breakdown["s_affinity"],
                        total=breakdown["total"],
                    ),
                    explanation_tags=explanation_tags,
                    fits_3d=fits_3d,
                    remaining_capacity_pct=round(remaining_pct, 1),
                ))

                utilized_bin_codes.add(cand_bin.code)
                rem_qty -= alloc_qty
                allocated_in_round = True
                break

            if not allocated_in_round:
                # Không còn ô nào có thể nhận thêm
                break

        allocated_count = orig_qty - rem_qty
        total_units_allocated += allocated_count
        is_full = (rem_qty == 0)
        if is_full:
            fully_allocated_count += 1

        allocations.append(BatchSlottingAllocation(
            sku_id=sku.sku_id,
            name=sku.name,
            requested_quantity=orig_qty,
            allocated_quantity=allocated_count,
            unallocated_quantity=rem_qty,
            is_fully_allocated=is_full,
            is_split=(len(allocated_bins) > 1),
            bins=allocated_bins,
        ))

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    return BatchSlottingResponse(
        success=True,
        source="AI_ENGINE_BATCH",
        allocations=allocations,
        total_skus=len(request.items),
        total_units_requested=total_units_requested,
        total_units_allocated=total_units_allocated,
        bins_utilized_count=len(utilized_bin_codes),
        fully_allocated_skus_count=fully_allocated_count,
        computation_ms=round(elapsed_ms, 2),
        message=f"Đã phân bổ {total_units_allocated}/{total_units_requested} kiện hàng cho {len(allocations)} SKUs",
    )
