/**
 * PII Sanitizer – Bộ lọc dữ liệu nhạy cảm (Personally Identifiable Information)
 *
 * Chạy trước khi đóng gói Audit Event để thay thế các trường nhạy cảm
 * như password, token, creditCard... bằng placeholder an toàn.
 * Tuân thủ: GDPR, PCI-DSS, ISO 27001
 */

const SENSITIVE_KEYS = new Set([
  'password', 'newPassword', 'confirmPassword', 'oldPassword',
  'accessToken', 'refreshToken', 'token', 'secret', 'apiKey',
  'creditCard', 'creditCardNumber', 'cvv', 'cvc', 'cardNumber',
  'taxNumber', 'nationalId', 'ssn', 'socialSecurityNumber',
  'bankAccount', 'routingNumber', 'pin',
]);

const REDACTED = '[REDACTED_BY_AUDIT_SECURITY]';

/**
 * Đệ quy quét toàn bộ object/array và thay thế giá trị các trường nhạy cảm.
 * - Xử lý nested objects và arrays
 * - Case-insensitive key matching (chuyển sang lowercase để so sánh)
 * - Không mutate input gốc, trả về bản sao mới
 */
export function sanitizePayload(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizePayload);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
