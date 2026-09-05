import { Injectable, Logger } from '@nestjs/common';

/**
 * AI Engine HTTP Client – Proxy gọi Python FastAPI AI Slotting Engine
 *
 * Tính năng:
 * - Gọi POST /engine/solve cho Realtime Inbound Slotting
 * - Gọi POST /engine/re-slot cho Dynamic Re-slotting
 * - Graceful Degradation: Fallback sang heuristic nếu engine lỗi/timeout
 * - Health check: Kiểm tra Python engine có sống không
 */

export interface AiSlottingPayload {
  sku_profile: {
    sku_id: string;
    name: string;
    dimensions: { length: number; width: number; height: number };
    weight: number;
    quantity: number;
    required_zone_type: 'COLD' | 'AMBIENT' | 'THERMAL';
    abc_class: 'A' | 'B' | 'C';
    hazard_class?: string;
  };
  candidate_bins: Array<{
    code: string;
    zone: string;
    rack: string;
    shelf_level: number;
    cell: string;
    zone_type: 'COLD' | 'AMBIENT' | 'THERMAL';
    max_weight: number;
    current_weight: number;
    max_volume: number;
    current_volume: number;
    bin_dimensions: { length: number; width: number; height: number };
    height_from_ground: number;
    distance_to_gate: number;
    status: 'EMPTY' | 'PARTIAL' | 'FULL' | 'MAINTENANCE';
    existing_items: Array<{
      sku_id: string;
      dimensions: { length: number; width: number; height: number };
      position: [number, number, number];
    }>;
    stored_sku_ids: string[];
  }>;
  scoring_weights?: {
    w_abc: number;
    w_ergo: number;
    w_fill: number;
    w_affinity: number;
  };
  affinity_skus?: string[];
  max_results?: number;
}

export interface AiSlottingResult {
  success: boolean;
  source: 'AI_ENGINE' | 'FALLBACK_HEURISTIC';
  sku_id: string;
  recommendations: Array<{
    rank: number;
    bin_code: string;
    zone: string;
    rack: string;
    shelf_level: number;
    score: {
      s_abc: number;
      s_ergo: number;
      s_fill: number;
      s_affinity: number;
      total: number;
    };
    explanation_tags: string[];
    fits_3d: boolean;
    remaining_capacity_pct: number;
  }>;
  total_candidates: number;
  filtered_candidates: number;
  computation_ms: number;
}

export interface AiEngineHealth {
  status: string;
  engine: string;
  version: string;
  capabilities: string[];
}

@Injectable()
export class AiEngineClient {
  private readonly logger = new Logger(AiEngineClient.name);
  private readonly baseUrl: string;
  private readonly realtimeTimeoutMs: number;
  private readonly reslotTimeoutMs: number;

  constructor() {
    this.baseUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
    this.realtimeTimeoutMs = Number(process.env.AI_ENGINE_TIMEOUT_MS) || 500;
    this.reslotTimeoutMs = Number(process.env.AI_ENGINE_RESLOT_TIMEOUT_MS) || 60000;
  }

  /**
   * Gọi AI Engine để tìm vị trí cất hàng tối ưu (Realtime).
   * Timeout: 500ms. Nếu lỗi → trả về null (caller sẽ fallback).
   */
  async solveSlotting(payload: AiSlottingPayload): Promise<AiSlottingResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.realtimeTimeoutMs);

      const response = await fetch(`${this.baseUrl}/engine/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`AI Engine returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const result: AiSlottingResult = await response.json();
      result.source = 'AI_ENGINE';
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.warn(`AI Engine timeout after ${this.realtimeTimeoutMs}ms – falling back to heuristic`);
      } else {
        this.logger.warn(`AI Engine unreachable: ${error.message} – falling back to heuristic`);
      }
      return null;
    }
  }

  /**
   * Gọi AI Engine để tái bố trí kho (Batch / Re-slotting).
   * Timeout: 60s. Thường chạy qua BullMQ worker.
   */
  async requestReSlotting(payload: any): Promise<any | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.reslotTimeoutMs);

      const response = await fetch(`${this.baseUrl}/engine/re-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.error(`Re-slotting engine returned ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(`Re-slotting engine error: ${error.message}`);
      return null;
    }
  }

  /**
   * Kiểm tra Python AI Engine có sống không.
   */
  async healthCheck(): Promise<AiEngineHealth | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/engine/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}
