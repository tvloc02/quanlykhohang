import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ScanLookupDto } from './dto/scan-lookup.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * Controller cho phân hệ Scan-to-Identify (Tra cứu nhanh).
 *
 * Endpoint: GET /api/v1/scan/lookup?barcode=...&zone_code=...
 * Quyền truy cập: WAREHOUSE_STAFF (cần biết rõ nhân viên nào đang quét)
 */
@Controller('v1/scan')
@UseGuards(JwtAuthGuard)
export class ScanController {
  constructor(
    private readonly scanService: ScanService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('lookup')
  async lookup(@Query() dto: ScanLookupDto, @Req() req: any) {
    const result = await this.scanService.lookup(dto.barcode, dto.zone_code);

    // Ghi Audit Log: "Nhân viên X vừa quét mã Y tại vị trí Z"
    // Phát sự kiện ngầm, không chờ kết quả (fire-and-forget)
    this.auditLogService
      .append({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: 'SCAN_LOOKUP',
        resource: 'product',
        resourceId: result.data.product_id,
        metadata: {
          scanned_barcode: dto.barcode,
          zone_code: dto.zone_code || null,
          product_name: result.data.name,
          internal_sku: result.data.internal_sku,
        },
      })
      .catch((err) => {
        // Log lỗi nhưng không ảnh hưởng response
        console.warn('Audit log failed for scan lookup:', err.message);
      });

    return result;
  }
}
