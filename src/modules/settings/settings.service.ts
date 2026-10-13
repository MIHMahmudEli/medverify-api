import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(OrganizationSettings)
    private settingsRepository: Repository<OrganizationSettings>,
  ) {}

  async onModuleInit() {
    await this.getSettings();
  }

  async getSettings(): Promise<OrganizationSettings> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({
        orgName: 'MYSA Medical Center',
        orgCode: 'MMS',
        orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
        orgPhone: '+880 1700-000000',
        orgEmail: 'info@mysamedicalbd.com',
        reportHeaderTitle: 'MEDICAL TEST REPORT',
        disclaimerText: 'This is an auto generated report, does not require any signature.',
      });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  async updateSettings(dto: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }
}
