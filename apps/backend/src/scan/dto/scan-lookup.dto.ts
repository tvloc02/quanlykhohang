import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO cho API tra cứu mã vạch nhanh (Scan-to-Identify).
 * Sử dụng class-validator để kiểm tra định dạng query parameters.
 *
 * Endpoint: GET /api/v1/scan/lookup?barcode=...&zone_code=...
 */
export class ScanLookupDto {
  @IsNotEmpty({ message: 'Mã barcode không được để trống' })
  @IsString({ message: 'Mã barcode phải là chuỗi ký tự' })
  @MinLength(1, { message: 'Mã barcode phải có ít nhất 1 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  barcode: string;

  @IsOptional()
  @IsString({ message: 'zone_code phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  zone_code?: string;
}
