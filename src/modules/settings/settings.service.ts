import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';
import { ensureSchema } from '../../database/schema-init';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(OrganizationSettings)
    private settingsRepository: Repository<OrganizationSettings>,
  ) {}

  async onModuleInit() {
    await ensureSchema(this.settingsRepository.manager.connection);
    await this.getSettings();
  }

  async getSettings(): Promise<OrganizationSettings> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({
        orgName: 'MYSA Medical Center',
        orgCode: 'MMS',
        orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
        orgAddressLine2: 'VIP Road, Dhaka-1000',
        orgPhone: '+880 1700-000000',
        orgEmail: 'info@mysamedicalbd.com',
        reportHeaderTitle: 'MEDICAL TEST REPORT',
        disclaimerText: 'This is an auto generated report, does not require any signature.',
        certificateTitle: 'MEDICAL FITNESS CERTIFICATE',
        certificateNumberPrefix: 'MC',
        signatoryName: 'Dr. A. K. M. Shamsuddin',
        signatoryDesignation: 'MBBS, FCPS - Medical Director',
        signatoryLicenseNumber: 'BMDC Reg No: A-12345',
        certificateFooter: 'This official certificate verifies fitness for overseas employment. Authenticate online using the security QR code.',
        certificateValidityDays: 90,
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
