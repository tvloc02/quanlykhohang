/**
 * Cryptographic Hash Chaining – Bảo vệ tính bất biến của Audit Log
 *
 * Mỗi bản ghi Audit Log mới sẽ tạo mã băm SHA-256 từ:
 *   CurrentHash = SHA-256(LogData + PreviousHash + SystemSalt)
 *
 * Nếu bất kỳ bản ghi nào bị sửa đổi, toàn bộ chuỗi hash phía sau
 * sẽ sai lệch → phát hiện ngay vị trí bị can thiệp.
 *
 * Tương tự nguyên lý Merkle Tree / Blockchain.
 */

import { createHash } from 'crypto';

const SYSTEM_SALT = process.env.AUDIT_HASH_SALT || 'SmartWMS_AuditChain_2026';

export interface AuditHashInput {
  action: string;
  resource: string;
  resourceId?: string;
  actorId?: string;
  actorEmail?: string;
  ipAddress?: string;
  statusCode?: number;
  createdAt: string; // ISO 8601
  metadata?: unknown;
}

/**
 * Tính SHA-256 hash cho một bản ghi audit log.
 * @param logData – Dữ liệu cốt lõi của bản ghi
 * @param previousHash – Hash của bản ghi đứng trước (genesis record dùng '0')
 * @returns 64-char hex SHA-256 hash
 */
export function computeAuditHash(logData: AuditHashInput, previousHash: string = '0'): string {
  const payload = JSON.stringify({
    action: logData.action,
    resource: logData.resource,
    resourceId: logData.resourceId || '',
    actorId: logData.actorId || '',
    actorEmail: logData.actorEmail || '',
    ipAddress: logData.ipAddress || '',
    statusCode: logData.statusCode ?? 0,
    createdAt: logData.createdAt,
    metadata: logData.metadata ? JSON.stringify(logData.metadata) : '',
  });

  const raw = `${payload}|${previousHash}|${SYSTEM_SALT}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Kiểm tra tính toàn vẹn của chuỗi hash cho một loạt bản ghi audit.
 * @param records – Mảng bản ghi đã sort theo createdAt ASC
 * @returns Object chứa kết quả kiểm tra: valid, brokenAtIndex (nếu bị phá vỡ)
 */
export function verifyHashChain(
  records: Array<AuditHashInput & { hashChecksum: string | null }>,
): { valid: boolean; totalChecked: number; brokenAtIndex?: number; brokenRecord?: unknown } {
  if (records.length === 0) return { valid: true, totalChecked: 0 };

  let previousHash = '0'; // Genesis

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record.hashChecksum) {
      // Bản ghi cũ chưa có hash → bỏ qua (backward compatible)
      continue;
    }
    const expectedHash = computeAuditHash(record, previousHash);
    if (expectedHash !== record.hashChecksum) {
      return {
        valid: false,
        totalChecked: i + 1,
        brokenAtIndex: i,
        brokenRecord: { action: record.action, resource: record.resource, createdAt: record.createdAt },
      };
    }
    previousHash = record.hashChecksum;
  }

  return { valid: true, totalChecked: records.length };
}
