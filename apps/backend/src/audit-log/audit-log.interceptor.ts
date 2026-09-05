import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';
import { sanitizePayload } from './utils/sanitize-payload.util';
import { randomUUID } from 'crypto';

/**
 * AuditLogInterceptor Enterprise – Chặn bắt vòng đời Request/Response
 *
 * Trích xuất đầy đủ ngữ cảnh 5W1H:
 * - WHO: actorId, actorEmail, actorRole (từ JWT Guard)
 * - WHAT/WHERE: resource, action, resourceId
 * - HOW: ipAddress (X-Forwarded-For), userAgent, httpMethod, traceId
 * - DIFF: metadata (đã sanitize PII)
 * - WHEN/STATUS: statusCode, latencyMs, createdAt
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = req.method;

    // Only log mutations (state-changing operations)
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID().replace(/-/g, '').slice(0, 32);

    // ─── Extract URL & Resource ──────────────────────
    const url = req.originalUrl || req.url;
    const urlParts = url.split('?')[0].split('/').filter(Boolean);
    let resourceRaw = urlParts.length > 1 && urlParts[0] === 'api' ? urlParts[1] : urlParts[0];

    if (!resourceRaw) return next.handle();

    // Remove pluralization (basic)
    let resource = resourceRaw;
    if (resource.endsWith('ies')) resource = resource.slice(0, -3) + 'y';
    else if (resource.endsWith('s')) resource = resource.slice(0, -1);

    // ─── Extract Client IP (Nginx/Proxy compatible) ──
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = forwardedFor
      ? (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : forwardedFor[0])
      : (req.socket?.remoteAddress || req.ip || '0.0.0.0');

    // ─── Extract User Agent ──────────────────────────
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown-Device';

    // ─── Sanitize Body (PII Protection) ──────────────
    const cleanBody = method !== 'DELETE' ? sanitizePayload(req.body) : undefined;

    return next.handle().pipe(
      tap((responseData) => {
        const latencyMs = Date.now() - startTime;
        const statusCode = res.statusCode || 200;

        // ─── Determine Action ────────────────────────
        let action = 'update';
        if (method === 'POST') action = 'create';
        if (method === 'DELETE') action = 'delete';

        // Custom action overrides based on URL paths
        if (url.includes('/transition') || url.includes('/post')) action = 'post';
        if (url.includes('/approve')) action = 'approve';
        if (url.includes('/reject')) action = 'reject';
        if (url.includes('/allocate')) action = 'allocate';
        if (url.includes('/release')) action = 'release';
        if (url.includes('/adjust')) action = 'adjust';

        const resourceId = responseData?.id || responseData?.data?.id || req.params?.id || undefined;

        this.auditLogService.append({
          // WHO
          actorId: req.user?.id,
          actorEmail: req.user?.email,
          actorRole: req.user?.role || req.user?.roles?.[0] || undefined,
          // WHAT & WHERE
          action: `${resource}.${action}`,
          resource,
          resourceId: resourceId ? String(resourceId) : undefined,
          // HOW
          ipAddress: clientIp,
          userAgent: userAgent.substring(0, 500),
          httpMethod: method,
          traceId,
          // DIFF
          metadata: cleanBody as Record<string, unknown> | undefined,
          // STATUS
          statusCode,
          latencyMs,
        }).catch(err => console.error('[AuditLog] Failed to append:', err.message));
      }),
      catchError((error) => {
        // Log failed requests too (4xx/5xx errors)
        const latencyMs = Date.now() - startTime;
        const statusCode = error?.status || error?.getStatus?.() || 500;

        this.auditLogService.append({
          actorId: req.user?.id,
          actorEmail: req.user?.email,
          actorRole: req.user?.role || req.user?.roles?.[0] || undefined,
          action: `${resource}.${method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update'}_failed`,
          resource,
          resourceId: req.params?.id ? String(req.params.id) : undefined,
          ipAddress: clientIp,
          userAgent: userAgent.substring(0, 500),
          httpMethod: method,
          traceId,
          metadata: { error: error?.message, ...(cleanBody as Record<string, unknown> || {}) },
          statusCode,
          latencyMs,
        }).catch(err => console.error('[AuditLog] Failed to append error log:', err.message));

        throw error; // Re-throw to let NestJS handle the error normally
      }),
    );
  }
}
