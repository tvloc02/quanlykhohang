import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepo: Repository<SystemSetting>,
  ) {}

  async getSettings(): Promise<SystemSetting> {
    let setting = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!setting) {
      setting = this.settingsRepo.create({
        id: 1,
        companyName: 'Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng',
        department: 'Bộ phận: Bán hàng',
        taxCode: '0101234567',
        address: 'Lô B11, số 9a, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội',
        phone: '024.3756.8888',
        email: 'ketoanthienung@gmail.com',
        website: 'ketoanthienung.vn',
        debitAccount: '632',
        creditAccount: '156',
        creatorName: 'Vũ Hữu Dũng',
        receiverName: 'Phạm Thị Duyên',
        storekeeperName: 'Nguyễn Thị Thúy',
        chiefAccountantName: 'Trần Thị Hồng Mơ',
        directorName: 'Nguyễn Thị Thanh Xuyên',
        templateStandard: 'Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính',
        transferStandard: 'Phụ lục 5 ban hành kèm Thông tư số 153/2010/TT-BTC ngày 28/9/2010 của Bộ Tài chính',
        transferFormNo: '03XKNB',
        transferSymbol: '6C26TNB',
        transferDispatchNo: '12/LĐĐ-KTTU',
        transferDispatchDate: '',
        transferDispatchBy: 'Ban Giám đốc Công ty',
        transferDispatchReason: 'Điều chuyển hàng hóa nội bộ phục vụ sản xuất / kinh doanh',
        transferContractNo: 'HĐVC-01/2026',
        transferTransporter: 'Tạ Văn Thanh',
        transferVehicle: 'Xe tải bán tải số 30L-63686',
        transferCreatorName: 'Vũ Hữu Dũng',
        transferExportStorekeeper: 'Nguyễn Thị Thúy',
        transferImportStorekeeper: 'Phạm Thị Duyên',
      });
      await this.settingsRepo.save(setting);
    }
    return setting;
  }

  async updateSettings(dto: Partial<SystemSetting>): Promise<SystemSetting> {
    let setting = await this.getSettings();
    Object.assign(setting, dto);
    setting.id = 1;
    return await this.settingsRepo.save(setting);
  }
}
