import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    
    // Only log mutations
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const url = req.originalUrl || req.url;
    // Extract base resource name (e.g., /api/products -> product)
    const urlParts = url.split('?')[0].split('/').filter(Boolean);
    let resourceRaw = urlParts.length > 1 && urlParts[0] === 'api' ? urlParts[1] : urlParts[0];
    
    if (!resourceRaw) return next.handle();

    // Remove pluralization (basic)
    let resource = resourceRaw;
    if (resource.endsWith('ies')) resource = resource.slice(0, -3) + 'y';
    else if (resource.endsWith('s')) resource = resource.slice(0, -1);

    return next.handle().pipe(
      tap((res) => {
        let action = 'update';
        if (method === 'POST') action = 'create';
        if (method === 'DELETE') action = 'delete';

        // Custom action overrides based on URL paths
        if (url.includes('/transition') || url.includes('/post')) action = 'post';

        let resourceId = res?.id || res?.data?.id || req.params?.id || undefined;
        let metadata = {};

        // To avoid storing huge bodies, only store essential things or small DTOs
        if (method !== 'DELETE') {
           metadata = { body: req.body };
        }

        this.auditLogService.append({
          actorId: req.user?.id,
          actorEmail: req.user?.email,
          action: `${resource}.${action}`,
          resource,
          resourceId: resourceId ? String(resourceId) : undefined,
          metadata,
        }).catch(err => console.error('Failed to append audit log', err));
      })
    );
  }
}
