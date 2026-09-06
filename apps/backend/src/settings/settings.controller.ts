import { Controller, Get, Post, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SystemSetting } from './entities/setting.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(): Promise<SystemSetting> {
    return await this.settingsService.getSettings();
  }

  @Post()
  async updateSettings(@Body() dto: Partial<SystemSetting>): Promise<SystemSetting> {
    return await this.settingsService.updateSettings(dto);
  }

  @Put()
  async putSettings(@Body() dto: Partial<SystemSetting>): Promise<SystemSetting> {
    return await this.settingsService.updateSettings(dto);
  }

  @Patch()
  async patchSettings(@Body() dto: Partial<SystemSetting>): Promise<SystemSetting> {
    return await this.settingsService.updateSettings(dto);
  }
}
