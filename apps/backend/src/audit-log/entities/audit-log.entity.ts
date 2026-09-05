import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Audit Log Entity – Chuẩn Enterprise 5W1H
 *
 * Mỗi bản ghi trả lời trọn vẹn: WHO, WHAT, WHERE, WHEN, HOW, WHY
 * Tuân thủ: ISO 27001, SOC 2 Type II, GDPR
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  // ─── WHO ────────────────────────────────────────────
  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'ID người thực hiện thao tác' })
  @Index('idx_audit_actor_id')
  actorId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Email người thực hiện' })
  actorEmail?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Role: admin/manager/staff' })
  actorRole?: string;

  // ─── WHAT & WHERE ──────────────────────────────────
  @Column({ type: 'varchar', length: 100, comment: 'Mã hành động: resource.verb (stock_in_receipt.approve)' })
  @Index('idx_audit_action')
  action: string;

  @Column({ type: 'varchar', length: 100, comment: 'Thực thể nghiệp vụ bị tác động' })
  resource: string;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'ID bản ghi nghiệp vụ' })
  @Index('idx_audit_resource_target')
  resourceId?: string;

  // ─── HOW (Context) ─────────────────────────────────
  @Column({ type: 'varchar', length: 45, nullable: true, comment: 'Client IP (IPv4/IPv6), hỗ trợ X-Forwarded-For' })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'User-Agent: Web Browser / PDA Scanner' })
  userAgent?: string;

  @Column({ type: 'varchar', length: 10, nullable: true, comment: 'HTTP Method: GET/POST/PUT/DELETE' })
  httpMethod?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'Trace ID cho distributed tracing' })
  traceId?: string;

  // ─── STATE CHANGE (DIFF) ───────────────────────────
  @Column({ type: 'simple-json', nullable: true, comment: 'Snapshot dữ liệu trước khi thay đổi' })
  oldState?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true, comment: 'Snapshot dữ liệu sau khi thay đổi' })
  newState?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true, comment: 'Metadata bổ sung đã lọc PII' })
  metadata?: Record<string, unknown>;

  // ─── WHEN & STATUS ─────────────────────────────────
  @Column({ type: 'int', default: 200, comment: 'HTTP Status Code: 200/400/403/500' })
  statusCode?: number;

  @Column({ type: 'int', unsigned: true, nullable: true, comment: 'Thời gian thực thi Request (ms)' })
  latencyMs?: number;

  @CreateDateColumn({ type: 'datetime', comment: 'Thời điểm ghi nhận UTC' })
  createdAt: Date;

  // ─── INTEGRITY (Hash Chain) ────────────────────────
  @Column({ type: 'char', length: 64, nullable: true, comment: 'SHA-256 hash chain checksum' })
  hashChecksum?: string;
}
