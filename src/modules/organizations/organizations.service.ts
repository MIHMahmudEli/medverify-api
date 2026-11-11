import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationSettings)
    private organizationRepository: Repository<OrganizationSettings>,
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
  ) {}

  async findAll(): Promise<any[]> {
    const orgs = await this.organizationRepository.find({
      order: {
        createdAt: 'ASC',
      },
    });

    // Attach report count to each organization
    const results = await Promise.all(
      orgs.map(async (org) => {
        const reportCount = await this.reportRepository.count({
          where: { organizationId: org.id },
        });
        return {
          ...org,
          reportCount,
        };
      }),
    );

    return results;
  }

  async findOne(id: string): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return org;
  }

  async getDefault(): Promise<OrganizationSettings> {
    let org = await this.organizationRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!org) {
      org = this.organizationRepository.create({
        orgName: 'MYSA Medical Center',
        orgCode: 'MMS',
        orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
        orgPhone: '+880 1700-000000',
        orgEmail: 'info@mysamedicalbd.com',
        reportHeaderTitle: 'MEDICAL TEST REPORT',
        disclaimerText: 'This is an auto generated report, does not require any signature.',
        certificateTitle: 'MEDICAL FITNESS CERTIFICATE',
        certificateNumberPrefix: 'MC',
        signatoryName: 'Dr. A. K. M. Shamsuddin',
        signatoryDesignation: 'MBBS, FCPS - Medical Director',
        signatoryLicenseNumber: 'BMDC Reg No: A-12345',
        certificateFooter:
          'This official certificate verifies fitness for overseas employment. Authenticate online using the security QR code.',
        certificateValidityDays: 90,
        isActive: true,
      });
      org = await this.organizationRepository.save(org);
    }
    return org;
  }

  async create(dto: CreateOrganizationDto): Promise<OrganizationSettings> {
    const existing = await this.organizationRepository.findOne({
      where: { orgCode: dto.orgCode.trim().toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(
        `Organization code "${dto.orgCode}" is already in use by "${existing.orgName}"`,
      );
    }

    const org = this.organizationRepository.create({
      ...dto,
      orgCode: dto.orgCode.trim().toUpperCase(),
      certificateNumberPrefix: (dto.certificateNumberPrefix || 'MC').trim().toUpperCase(),
    });

    return this.organizationRepository.save(org);
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationSettings> {
    const org = await this.findOne(id);

    if (dto.orgCode && dto.orgCode.trim().toUpperCase() !== org.orgCode) {
      const codeClash = await this.organizationRepository.findOne({
        where: { orgCode: dto.orgCode.trim().toUpperCase() },
      });
      if (codeClash && codeClash.id !== id) {
        throw new BadRequestException(
          `Organization code "${dto.orgCode}" is already in use by "${codeClash.orgName}"`,
        );
      }
    }

    Object.assign(org, {
      ...dto,
      ...(dto.orgCode ? { orgCode: dto.orgCode.trim().toUpperCase() } : {}),
      ...(dto.certificateNumberPrefix
        ? { certificateNumberPrefix: dto.certificateNumberPrefix.trim().toUpperCase() }
        : {}),
    });

    return this.organizationRepository.save(org);
  }

  async setDefault(id: string): Promise<OrganizationSettings> {
    const org = await this.findOne(id);
    return org;
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const org = await this.findOne(id);

    const reportCount = await this.reportRepository.count({
      where: { organizationId: id },
    });

    if (reportCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${org.orgName}" because ${reportCount} medical reports are associated with it.`,
      );
    }

    await this.organizationRepository.delete(id);
    return {
      success: true,
      message: `Organization "${org.orgName}" successfully deleted.`,
    };
  }
}
