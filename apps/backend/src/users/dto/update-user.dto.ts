export class UpdateUserDto {
  email?: string;
  password?: string;
  role?: string;
  fullName?: string;
  phone?: string;
  status?: 'active' | 'inactive';
}
