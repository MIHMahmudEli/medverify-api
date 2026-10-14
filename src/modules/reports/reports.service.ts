import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MedicalReport,
  ReportStatus,
  MedicalFitnessStatus,
} from '../../database/entities/medical-report.entity';
import { MedicalReportRevision } from '../../database/entities/medical-report-revision.entity';
import { Patient } from '../../database/entities/patient.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { TemplatesService } from '../templates/templates.service';
import { VerificationService } from '../verification/verification.service';
import { PdfService } from '../pdf/pdf.service';
import {
  MedicalCertificate,
  CertificateStatus,
} from '../../database/entities/medical-certificate.entity';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';
import {
  CreateReportDto,
  UpdateReportDto,
  FinalizeReportDto,
  AmendReportDto,
  RevokeReportDto,
} from './dto/report.dto';
import { PaginationQueryDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
    @InjectRepository(MedicalReportRevision)
    private revisionRepository: Repository<MedicalReportRevision>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(MedicalCertificate)
    private certificateRepository: Repository<MedicalCertificate>,
    @InjectRepository(OrganizationSettings)
    private settingsRepository: Repository<OrganizationSettings>,
    private templatesService: TemplatesService,
    private verificationService: VerificationService,
    private pdfService: PdfService,
    private dataSource: DataSource,
  ) {}

  private async generateRegistrationNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `MMS${yy}${mm}`;

    // Get count of reports this month to generate sequence
    const count = await this.reportRepository.count();
    const seq = String(count + 101).padStart(3, '0');
    let regNo = `${prefix}${seq}`;

    // Ensure uniqueness
    let exists = await this.reportRepository.findOne({ where: { registrationNumber: regNo } });
    let salt = 1;
    while (exists) {
      regNo = `${prefix}${String(count + 101 + salt).padStart(3, '0')}`;
      exists = await this.reportRepository.findOne({ where: { registrationNumber: regNo } });
      salt++;
    }

    return regNo;
  }

  async findAll(
    query: PaginationQueryDto & {
      status?: ReportStatus;
      finalMedicalStatus?: MedicalFitnessStatus;
      patientId?: string;
    },
  ): Promise<PaginatedResult<MedicalReport>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.patient', 'patient')
      .leftJoinAndSelect('report.finalizedBy', 'finalizedBy')
      .leftJoinAndSelect('report.createdBy', 'createdBy');

    if (query.status) {
      qb.andWhere('report.status = :status', { status: query.status });
    }

    if (query.finalMedicalStatus) {
      qb.andWhere('report.finalMedicalStatus = :finalMedicalStatus', {
        finalMedicalStatus: query.finalMedicalStatus,
      });
    }

    if (query.patientId) {
      qb.andWhere('report.patientId = :patientId', { patientId: query.patientId });
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(LOWER(report.registrationNumber) LIKE LOWER(:term) OR LOWER(patient.fullName) LIKE LOWER(:term) OR LOWER(patient.passportNumber) LIKE LOWER(:term))',
        { term },
      );
    }

    const validSort = ['registrationNumber', 'registeredAt', 'createdAt', 'status'];
    const sortField = validSort.includes(query.sortBy) ? `report.${query.sortBy}` : 'report.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortField, sortOrder);
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<MedicalReport> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'patient',
        'templateVersion',
        'finalizedBy',
        'createdBy',
        'revisions',
        'revisions.changedBy',
        'verificationTokens',
      ],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async create(dto: CreateReportDto, user: User): Promise<MedicalReport> {
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} not found`);
    }

    let templateVersionId = dto.templateVersionId;
    if (!templateVersionId) {
      const active = await this.templatesService.getActiveTemplate();
      templateVersionId = active.activeVersion.id;
    }

    const regNo = await this.generateRegistrationNumber();
    const now = new Date().toISOString().split('T')[0];

    const report = this.reportRepository.create({
      registrationNumber: regNo,
      patientId: dto.patientId,
      templateVersionId,
      status: ReportStatus.DRAFT,
      registeredAt: dto.registeredAt || now,
      reportData: dto.reportData || {},
      finalMedicalStatus: MedicalFitnessStatus.NOT_EVALUATED,
      xrayFinding: dto.xrayFinding || 'NORMAL',
      xrayRemarks: dto.xrayRemarks || 'NORMAL',
      xrayImageUrl: dto.xrayImageUrl,
      fingerprintUrl: dto.fingerprintUrl || patient.fingerprintUrl,
      createdById: user.id,
      currentRevisionNumber: 1,
    });

    return this.reportRepository.save(report);
  }

  async update(id: string, dto: UpdateReportDto, user: User): Promise<MedicalReport> {
    const report = await this.findOne(id);

    if (report.status === ReportStatus.FINALIZED || report.status === ReportStatus.REVOKED) {
      throw new BadRequestException(
        `Report is ${report.status}. Use the amend workflow to make changes to finalized reports.`,
      );
    }

    if (dto.registeredAt) report.registeredAt = dto.registeredAt;
    if (dto.status && [ReportStatus.DRAFT, ReportStatus.IN_REVIEW].includes(dto.status)) {
      report.status = dto.status;
    }
    if (dto.reportData) {
      report.reportData = { ...report.reportData, ...dto.reportData };
    }
    if (dto.xrayFinding !== undefined) report.xrayFinding = dto.xrayFinding;
    if (dto.xrayRemarks !== undefined) report.xrayRemarks = dto.xrayRemarks;
    if (dto.xrayImageUrl !== undefined) report.xrayImageUrl = dto.xrayImageUrl;
    if (dto.fingerprintUrl !== undefined) report.fingerprintUrl = dto.fingerprintUrl;

    report.updatedById = user.id;

    return this.reportRepository.save(report);
  }

  async submitForReview(id: string, user: User): Promise<MedicalReport> {
    const report = await this.findOne(id);
    if (report.status !== ReportStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT reports can be submitted for review');
    }

    report.status = ReportStatus.IN_REVIEW;
    report.updatedById = user.id;
    return this.reportRepository.save(report);
  }

  async finalize(id: string, dto: FinalizeReportDto, user: User): Promise<MedicalReport> {
    const report = await this.findOne(id);

    if (report.status === ReportStatus.FINALIZED) {
      throw new BadRequestException('Report is already finalized');
    }

    if (report.status === ReportStatus.REVOKED) {
      throw new BadRequestException('Cannot finalize a revoked report');
    }

    return this.dataSource.transaction(async (manager) => {
      report.status = ReportStatus.FINALIZED;
      report.finalMedicalStatus = dto.finalMedicalStatus;
      report.finalRemarks = dto.finalRemarks || 'NORMAL';
      report.finalizedById = user.id;
      report.finalizedAt = new Date();
      report.updatedById = user.id;

      const savedReport = await manager.save(MedicalReport, report);

      // Create snapshot revision 1
      const revision = manager.create(MedicalReportRevision, {
        reportId: savedReport.id,
        revisionNumber: 1,
        status: ReportStatus.FINALIZED,
        finalMedicalStatus: savedReport.finalMedicalStatus,
        reportDataSnapshot: savedReport.reportData,
        patientDataSnapshot: {
          fullName: report.patient.fullName,
          passportNumber: report.patient.passportNumber,
          dateOfBirth: report.patient.dateOfBirth,
          nationality: report.patient.nationality,
          country: report.patient.country,
        },
        reasonForChange: 'Initial Report Finalization',
        changedById: user.id,
      });
      await manager.save(MedicalReportRevision, revision);

      // Create verification token
      await this.verificationService.createTokenForReport(savedReport.id);

      return this.findOne(savedReport.id);
    });
  }

  async amend(id: string, dto: AmendReportDto, user: User): Promise<MedicalReport> {
    const report = await this.findOne(id);

    if (report.status !== ReportStatus.FINALIZED && report.status !== ReportStatus.AMENDED) {
      throw new BadRequestException('Only finalized reports can be amended');
    }

    return this.dataSource.transaction(async (manager) => {
      // Revoke previous verification token
      await this.verificationService.revokeTokensForReport(
        report.id,
        `Amended: ${dto.reasonForChange}`,
        user.id,
      );

      const nextRevision = report.currentRevisionNumber + 1;
      report.currentRevisionNumber = nextRevision;
      report.status = ReportStatus.FINALIZED;
      report.finalMedicalStatus = dto.finalMedicalStatus;
      if (dto.finalRemarks) report.finalRemarks = dto.finalRemarks;
      report.reportData = dto.reportData;
      if (dto.xrayFinding) report.xrayFinding = dto.xrayFinding;
      if (dto.xrayRemarks) report.xrayRemarks = dto.xrayRemarks;
      report.updatedById = user.id;

      const savedReport = await manager.save(MedicalReport, report);

      // Save revision snapshot
      const revision = manager.create(MedicalReportRevision, {
        reportId: savedReport.id,
        revisionNumber: nextRevision,
        status: ReportStatus.FINALIZED,
        finalMedicalStatus: savedReport.finalMedicalStatus,
        reportDataSnapshot: savedReport.reportData,
        patientDataSnapshot: {
          fullName: report.patient.fullName,
          passportNumber: report.patient.passportNumber,
          dateOfBirth: report.patient.dateOfBirth,
        },
        reasonForChange: dto.reasonForChange,
        changedById: user.id,
      });
      await manager.save(MedicalReportRevision, revision);

      // Issue new active verification token
      await this.verificationService.createTokenForReport(savedReport.id);

      // Supersede previous active certificates for this report
      await manager.update(
        MedicalCertificate,
        { reportId: report.id, status: CertificateStatus.ACTIVE },
        { status: CertificateStatus.SUPERSEDED },
      );

      return this.findOne(savedReport.id);
    });
  }

  async revoke(id: string, dto: RevokeReportDto, user: User): Promise<MedicalReport> {
    const report = await this.findOne(id);

    report.status = ReportStatus.REVOKED;
    report.updatedById = user.id;

    await this.verificationService.revokeTokensForReport(
      report.id,
      dto.revocationReason,
      user.id,
    );

    // Revoke any active certificates for this report
    await this.certificateRepository.update(
      { reportId: report.id, status: CertificateStatus.ACTIVE },
      {
        status: CertificateStatus.REVOKED,
        revocationReason: dto.revocationReason,
        revokedAt: new Date(),
        revokedById: user.id,
      },
    );

    return this.reportRepository.save(report);
  }

  async getPdfBuffer(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.findOne(id);
    const settings = await this.settingsRepository.findOne({ where: {} });
    const buffer = await this.pdfService.generateReportPdf(report, report.patient, settings || undefined);
    const filename = `MedVerify_${report.registrationNumber}_${report.patient.passportNumber}.pdf`;
    return { buffer, filename };
  }

  async getCombinedPrintPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.findOne(id);
    let cert = await this.certificateRepository.findOne({
      where: { reportId: report.id, status: CertificateStatus.ACTIVE },
      relations: ['issuedBy', 'report', 'patient'],
    });

    if (!cert && report.status === ReportStatus.FINALIZED) {
      const systemAdminId = report.finalizedById || report.createdById;
      const certCount = await this.certificateRepository.count();
      const seq = String(certCount + 1).padStart(5, '0');
      const year = new Date().getFullYear();
      const newCert = this.certificateRepository.create({
        reportId: report.id,
        patientId: report.patientId,
        certificateNumber: `MC-${year}-${seq}`,
        verificationToken: require('crypto').randomBytes(24).toString('hex'),
        status: CertificateStatus.ACTIVE,
        issuedAt: new Date(),
        issuedById: systemAdminId,
      });
      cert = await this.certificateRepository.save(newCert);
    }

    const settings = await this.settingsRepository.findOne({ where: {} });
    let buffer: Buffer;
    if (cert) {
      buffer = await this.pdfService.generateCombinedPdf(
        cert,
        report,
        report.patient,
        settings || undefined,
      );
    } else {
      buffer = await this.pdfService.generateReportPdf(report, report.patient, settings || undefined);
    }

    const safeReg = report.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Official_Medical_Record_${safeReg}.pdf`;
    return { buffer, filename };
  }
}
