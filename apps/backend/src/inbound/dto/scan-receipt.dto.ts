import { IsString } from 'class-validator';

export class ScanReceiptDto {
  @IsString()
  barcode: string;
}
