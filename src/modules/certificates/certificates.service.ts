import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  MedicalCertificate,
  CertificateStatus,
} from '../../database/entities/medical-certificate.entity';
import {
  MedicalReport,
  ReportStatus,
  MedicalFitnessStatus,
} from '../../database/entities/medical-report.entity';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { Patient } from '../../database/entities/patient.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { PdfService } from '../pdf/pdf.service';
import { AuditService } from '../audit/audit.service';
import { VerificationService } from '../verification/verification.service';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(MedicalCertificate)
    private certificateRepository: Repository<MedicalCertificate>,
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
    @InjectRepository(ReportVerificationToken)
    private tokenRepository: Repository<ReportVerificationToken>,
    private settingsService: SettingsService,
    private pdfService: PdfService,
    private auditService: AuditService,
    private verificationService: VerificationService,
  ) {}

  /**
   * Generates a safe, sequential, unique certificate number.
   * Format: PREFIX-YEAR-SEQUENCE (e.g. MC-2026-00101)
   */
  private async generateCertificateNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.certificateRepository.count();
    const seq = (count + 1).toString().padStart(5, '0');
    return `${prefix}-${year}-${seq}`;
  }

  /**
   * Issues an official Medical Fitness Certificate for a finalized report.
   * Enforces doctor/admin authorization, report status, and frozen snapshot.
   */
  async issueCertificate(
    reportId: string,
    user: User,
  ): Promise<MedicalCertificate> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: ['patient', 'revisions', 'finalizedBy'],
    });

    if (!report) {
      throw new NotFoundException(`Medical report with ID ${reportId} not found`);
    }

    if (report.status !== ReportStatus.FINALIZED) {
      throw new BadRequestException(
        `Cannot issue certificate. Report must be FINALIZED by an authorized physician before certification (Current status: ${report.status}).`,
      );
    }

    if (
      report.finalMedicalStatus !== MedicalFitnessStatus.FIT &&
      report.finalMedicalStatus !== MedicalFitnessStatus.UNFIT
    ) {
      throw new BadRequestException(
        `Cannot issue certificate. Final medical status must be explicitly approved as FIT or UNFIT (Current status: ${report.finalMedicalStatus}).`,
      );
    }

    const settings = await this.settingsService.getSettings();
    if (!settings.orgName || !settings.certificateTitle) {
      throw new BadRequestException(
        'Mandatory organization settings (Organization Name, Certificate Title) are missing. Please complete organization configuration before issuing certificates.',
      );
    }

    // Check if an ACTIVE certificate already exists for this report
    const existingActive = await this.certificateRepository.findOne({
      where: { reportId: report.id, status: CertificateStatus.ACTIVE },
    });

    if (existingActive) {
      // Mark existing as SUPERSEDED if report was amended or reissued
      existingActive.status = CertificateStatus.SUPERSEDED;
      await this.certificateRepository.save(existingActive);
    }

    const certPrefix = settings.certificateNumberPrefix || 'MC';
    const certificateNumber = await this.generateCertificateNumber(certPrefix);

    const tokenStr = this.verificationService.generateToken();
    const tokenHash = this.verificationService.hashToken(tokenStr);

    const issuedAt = new Date();
    let expiresAt: Date | undefined = undefined;
    if (settings.certificateValidityDays && settings.certificateValidityDays > 0) {
      expiresAt = new Date(issuedAt.getTime() + settings.certificateValidityDays * 86400000);
    }

    const latestRevision = report.revisions && report.revisions.length > 0
      ? report.revisions[report.revisions.length - 1]
      : null;

    // Freeze immutable snapshot of data at issuance time
    const snapshot = {
      certificateNumber,
      registrationNumber: report.registrationNumber,
      registeredAt: report.registeredAt,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      finalMedicalStatus: report.finalMedicalStatus,
      finalRemarks: report.finalRemarks,
      patient: {
        id: report.patient.id,
        fullName: report.patient.fullName,
        passportNumber: report.patient.passportNumber,
        dateOfBirth: report.patient.dateOfBirth,
        gender: report.patient.gender,
        nationality: report.patient.nationality,
        country: report.patient.country,
        agency: report.patient.agency,
      },
      organization: {
        orgName: settings.orgName,
        orgCode: settings.orgCode,
        orgAddress: settings.orgAddress,
        orgPhone: settings.orgPhone,
        orgEmail: settings.orgEmail,
        certificateTitle: settings.certificateTitle,
        signatoryName: settings.signatoryName,
        signatoryDesignation: settings.signatoryDesignation,
        signatoryLicenseNumber: settings.signatoryLicenseNumber,
      },
      xrayFinding: report.xrayFinding,
      xrayRemarks: report.xrayRemarks,
      revisionNumber: report.currentRevisionNumber,
    };

    const certificate = this.certificateRepository.create({
      certificateNumber,
      reportId: report.id,
      reportRevisionId: latestRevision?.id,
      patientId: report.patient.id,
      verificationToken: tokenStr,
      verificationTokenHash: tokenHash,
      status: CertificateStatus.ACTIVE,
      issuedAt,
      expiresAt,
      issuedById: user.id,
      approvedDisclosurePolicyVersion: 1,
      certificateDataSnapshot: snapshot,
    });

    const savedCert = await this.certificateRepository.save(certificate);

    // Sync active ReportVerificationToken with the same token string
    await this.tokenRepository.save(
      this.tokenRepository.create({
        reportId: report.id,
        token: tokenStr,
        tokenHash,
        isRevoked: false,
      }),
    );

    await this.auditService.log({
      userId: user.id,
      action: 'CERTIFICATE_ISSUED',
      entityType: 'MedicalCertificate',
      entityId: savedCert.id,
      details: {
        certificateNumber,
        reportId: report.id,
        registrationNumber: report.registrationNumber,
        finalMedicalStatus: report.finalMedicalStatus,
      },
    });

    return savedCert;
  }

  /**
   * Retrieves certificate details by certificate ID.
   */
  async getCertificateById(id: string): Promise<MedicalCertificate> {
    const cert = await this.certificateRepository.findOne({
      where: { id },
      relations: ['report', 'patient', 'issuedBy', 'revokedBy'],
    });

    if (!cert) {
      throw new NotFoundException(`Medical certificate with ID ${id} not found`);
    }

    return cert;
  }

  /**
   * Retrieves active or latest certificate for a specific medical report.
   */
  async getCertificateByReportId(reportId: string): Promise<MedicalCertificate | null> {
    const active = await this.certificateRepository.findOne({
      where: { reportId, status: CertificateStatus.ACTIVE },
      relations: ['patient', 'issuedBy'],
      order: { issuedAt: 'DESC' },
    });

    if (active) return active;

    return this.certificateRepository.findOne({
      where: { reportId },
      relations: ['patient', 'issuedBy'],
      order: { issuedAt: 'DESC' },
    });
  }

  /**
   * Revokes an issued certificate.
   */
  async revokeCertificate(
    id: string,
    reason: string,
    user: User,
  ): Promise<MedicalCertificate> {
    const cert = await this.getCertificateById(id);

    if (cert.status === CertificateStatus.REVOKED) {
      throw new BadRequestException('This certificate has already been revoked.');
    }

    cert.status = CertificateStatus.REVOKED;
    cert.revocationReason = reason;
    cert.revokedAt = new Date();
    cert.revokedById = user.id;

    const saved = await this.certificateRepository.save(cert);

    // Revoke linked token
    await this.tokenRepository.update(
      { token: cert.verificationToken },
      {
        isRevoked: true,
        revokedAt: cert.revokedAt,
        revocationReason: reason,
        revokedById: user.id,
      },
    );

    await this.auditService.log({
      userId: user.id,
      action: 'CERTIFICATE_REVOKED',
      entityType: 'MedicalCertificate',
      entityId: cert.id,
      details: {
        certificateNumber: cert.certificateNumber,
        reason,
      },
    });

    return saved;
  }

  /**
   * Generates standalone Certificate-Only PDF buffer (Page 1 only).
   */
  async getCertificatePdfBuffer(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const cert = await this.getCertificateById(id);
    const report = await this.reportRepository.findOne({
      where: { id: cert.reportId },
      relations: ['patient'],
    });
    if (!report) throw new NotFoundException('Associated report not found');

    const settings = await this.settingsService.getSettings();
    const buffer = await this.pdfService.generateCertificatePdf(
      cert,
      report,
      report.patient,
      settings,
    );

    const safeReg = report.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Certificate_${cert.certificateNumber}_${safeReg}.pdf`;

    return { buffer, filename };
  }

  /**
   * Generates combined official Two-Page PDF:
   * Page 1: Official Medical Fitness Certificate
   * Page 2: Detailed Medical Test Report
   */
  async getCombinedPdfBuffer(
    reportIdOrCertId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    let cert: MedicalCertificate | null = null;
    let report: MedicalReport | null = null;

    // Try finding by certificate id first
    cert = await this.certificateRepository.findOne({
      where: { id: reportIdOrCertId },
      relations: ['patient'],
    });

    if (cert) {
      report = await this.reportRepository.findOne({
        where: { id: cert.reportId },
        relations: ['patient'],
      });
    } else {
      // Find by report id
      report = await this.reportRepository.findOne({
        where: { id: reportIdOrCertId },
        relations: ['patient'],
      });
      if (!report) {
        throw new NotFoundException(`Medical record not found for ID ${reportIdOrCertId}`);
      }

      cert = await this.getCertificateByReportId(report.id);
      if (!cert && report.status === ReportStatus.FINALIZED) {
        // Auto-issue active certificate if report is finalized
        const systemAdmin = report.finalizedById
          ? ({ id: report.finalizedById } as User)
          : ({ id: report.createdById } as User);
        cert = await this.issueCertificate(report.id, systemAdmin);
      }
    }

    if (!report) throw new NotFoundException('Report not found');
    const settings = await this.settingsService.getSettings();

    const patient = report.patient || cert?.patient;
    let buffer: Buffer;
    if (cert) {
      buffer = await this.pdfService.generateCombinedPdf(
        cert,
        report,
        patient,
        settings,
      );
    } else {
      // Fallback to report pdf if certificate cannot be issued (e.g. Draft)
      buffer = await this.pdfService.generateReportPdf(report, patient);
    }

    const safeReg = report.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Official_Medical_Record_${safeReg}.pdf`;

    return { buffer, filename };
  }
}
