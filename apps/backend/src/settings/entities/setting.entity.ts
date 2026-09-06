import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 255, default: 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng' })
  companyName: string;

  @Column({ name: 'department', type: 'varchar', length: 255, default: 'Bộ phận: Bán hàng' })
  department: string;

  @Column({ name: 'tax_code', type: 'varchar', length: 50, default: '0101234567' })
  taxCode: string;

  @Column({ name: 'address', type: 'varchar', length: 500, default: 'Lô B11, số 9a, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội' })
  address: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, default: '024.3756.8888' })
  phone: string;

  @Column({ name: 'email', type: 'varchar', length: 100, default: 'ketoanthienung@gmail.com' })
  email: string;

  @Column({ name: 'website', type: 'varchar', length: 100, default: 'ketoanthienung.vn' })
  website: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string;

  @Column({ name: 'debit_account', type: 'varchar', length: 50, default: '632' })
  debitAccount: string;

  @Column({ name: 'credit_account', type: 'varchar', length: 50, default: '156' })
  creditAccount: string;

  @Column({ name: 'creator_name', type: 'varchar', length: 100, default: 'Vũ Hữu Dũng' })
  creatorName: string;

  @Column({ name: 'receiver_name', type: 'varchar', length: 100, default: 'Phạm Thị Duyên' })
  receiverName: string;

  @Column({ name: 'storekeeper_name', type: 'varchar', length: 100, default: 'Nguyễn Thị Thúy' })
  storekeeperName: string;

  @Column({ name: 'chief_accountant_name', type: 'varchar', length: 100, default: 'Trần Thị Hồng Mơ' })
  chiefAccountantName: string;

  @Column({ name: 'director_name', type: 'varchar', length: 100, default: 'Nguyễn Thị Thanh Xuyên' })
  directorName: string;

  @Column({ name: 'template_standard', type: 'varchar', length: 255, default: 'Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính' })
  templateStandard: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
