export class AssemblyComponentDto {
  detailId: string;
  usedQty: number;
}

export class CreateAssemblyDto {
  assembledProductId: string;
  assembledQty: number;
  barcode?: string;
  warehouseCode: string;
  note?: string;
  components: AssemblyComponentDto[];
}
