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

  async getSettings(orgId?: string): Promise<OrganizationSettings> {
    if (orgId) {
      const specific = await this.settingsRepository.findOne({ where: { id: orgId } });
      if (specific) return specific;
    }

    let settings = await this.settingsRepository.findOne({ where: { isDefault: true } });
    if (!settings) {
      settings = await this.settingsRepository.findOne({ where: {}, order: { createdAt: 'ASC' } });
    }
    if (!settings) {
      settings = this.settingsRepository.create({
        orgName: 'MYSA Medical Center',
        orgCode: 'MMS',
        orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
        orgAddressLine2: '',
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
        isDefault: true,
        isActive: true,
      });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  async getSettingsForReport(organizationId?: string): Promise<OrganizationSettings> {
    return this.getSettings(organizationId);
  }

  async updateSettings(dto: Partial<OrganizationSettings>, orgId?: string): Promise<OrganizationSettings> {
    const settings = await this.getSettings(orgId);
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }
}
