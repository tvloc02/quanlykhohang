export class CreateWarehouseDto {
  id?: string;
  code: string;
  name: string;
  address?: string;
  status?: 'active' | 'inactive';
  managerIds?: string[];
  staffIds?: string[];
}
