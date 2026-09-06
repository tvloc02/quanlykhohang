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
