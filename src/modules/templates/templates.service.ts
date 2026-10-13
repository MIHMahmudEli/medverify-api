import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportTemplate } from '../../database/entities/report-template.entity';
import { ReportTemplateVersion } from '../../database/entities/report-template-version.entity';
import { DEFAULT_MEDICAL_REPORT_SCHEMA } from './default-template.constant';
import {
  CreateTemplateDto,
  CreateTemplateVersionDto,
  UpdateTemplateDto,
} from './dto/template.dto';

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(
    @InjectRepository(ReportTemplate)
    private templateRepository: Repository<ReportTemplate>,
    @InjectRepository(ReportTemplateVersion)
    private versionRepository: Repository<ReportTemplateVersion>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultTemplate();
  }

  async ensureDefaultTemplate(): Promise<ReportTemplate> {
    const code = 'STANDARD_MMS_V1';
    let template = await this.templateRepository.findOne({
      where: { code },
      relations: ['versions'],
    });

    if (!template) {
      template = this.templateRepository.create({
        name: 'Standard Overseas Medical Test',
        code,
        description: 'Standard clinical and diagnostic template matching overseas testing protocols.',
        isActive: true,
      });
      template = await this.templateRepository.save(template);

      const version = this.versionRepository.create({
        templateId: template.id,
        versionNumber: 1,
        schema: DEFAULT_MEDICAL_REPORT_SCHEMA,
      });
      const savedVersion = await this.versionRepository.save(version);

      template.activeVersionId = savedVersion.id;
      return this.templateRepository.save(template);
    }

    return template;
  }

  async findAll(): Promise<ReportTemplate[]> {
    return this.templateRepository.find({
      relations: ['versions'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveTemplate(): Promise<{
    template: ReportTemplate;
    activeVersion: ReportTemplateVersion;
  }> {
    const template = await this.ensureDefaultTemplate();
    let activeVersion: ReportTemplateVersion | null = null;

    if (template.activeVersionId) {
      activeVersion = await this.versionRepository.findOne({
        where: { id: template.activeVersionId },
      });
    }

    if (!activeVersion) {
      activeVersion = await this.versionRepository.findOne({
        where: { templateId: template.id },
        order: { versionNumber: 'DESC' },
      });
    }

    if (!activeVersion) {
      throw new NotFoundException('No active version found for standard template');
    }

    return { template, activeVersion };
  }

  async findOne(id: string): Promise<ReportTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async create(dto: CreateTemplateDto, userId?: string): Promise<ReportTemplate> {
    const existing = await this.templateRepository.findOne({
      where: { code: dto.code.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Template with code ${dto.code} already exists`);
    }

    let template = this.templateRepository.create({
      name: dto.name,
      code: dto.code.trim().toUpperCase(),
      description: dto.description,
      isActive: true,
    });
    template = await this.templateRepository.save(template);

    const version = this.versionRepository.create({
      templateId: template.id,
      versionNumber: 1,
      schema: dto.schema,
      createdById: userId,
    });
    const savedVersion = await this.versionRepository.save(version);

    template.activeVersionId = savedVersion.id;
    return this.templateRepository.save(template);
  }

  async createVersion(
    templateId: string,
    dto: CreateTemplateVersionDto,
    userId?: string,
  ): Promise<ReportTemplateVersion> {
    const template = await this.findOne(templateId);

    const latestVersion = await this.versionRepository.findOne({
      where: { templateId },
      order: { versionNumber: 'DESC' },
    });

    const nextNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const version = this.versionRepository.create({
      templateId,
      versionNumber: nextNumber,
      schema: dto.schema,
      createdById: userId,
    });

    const savedVersion = await this.versionRepository.save(version);

    // Auto-update active version to latest
    template.activeVersionId = savedVersion.id;
    await this.templateRepository.save(template);

    return savedVersion;
  }

  async activateVersion(templateId: string, versionId: string): Promise<ReportTemplate> {
    const template = await this.findOne(templateId);
    const version = await this.versionRepository.findOne({
      where: { id: versionId, templateId },
    });

    if (!version) {
      throw new NotFoundException('Template version not found');
    }

    template.activeVersionId = version.id;
    return this.templateRepository.save(template);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ReportTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, dto);
    return this.templateRepository.save(template);
  }
}
