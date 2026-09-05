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
import numpy as np

from models import (
    SlottingRequest, SlottingResponse, BinRecommendation, ScoreBreakdown,
    ReSlottingRequest, ReSlottingResponse, RelocationOrder,
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
