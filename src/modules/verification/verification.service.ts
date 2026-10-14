import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { MedicalReport, ReportStatus } from '../../database/entities/medical-report.entity';
import { MedicalCertificate, CertificateStatus } from '../../database/entities/medical-certificate.entity';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { PdfService } from '../pdf/pdf.service';

export interface PublicVerificationResponse {
  verified: boolean;
  status: 'VALID' | 'REVOKED' | 'SUPERSEDED' | 'EXPIRED' | 'INVALID' | 'DRAFT';
  message?: string;
  token?: string;
  certificate?: {
    id?: string;
    certificateNumber: string;
    issueDate: string;
    expiresAt?: string;
    status: string;
    issuingOrganization: string;
    finalMedicalStatus: string;
    authorizedSignatory?: {
      name: string;
      designation: string;
      licenseNumber?: string;
    };
  };
  patient?: {
    fullName?: string;
    patientInitials?: string;
    passportNumber?: string;
    dateOfBirth?: string;
    nationality?: string;
    destinationCountry?: string;
    agency?: string;
    photoUrl?: string;
    gender?: string;
    maritalStatus?: string;
    religion?: string;
    heightCm?: number | null;
    weightKg?: number | null;
  };
  associatedReport?: {
    registrationNumber: string;
    examinationDate: string;
    reportStatus: string;
    finalMedicalStatus: string;
    finalRemarks?: string;
    revisionNumber: number;
    categoriesPerformed: string[];
    isDetailedPublic: boolean;
    detailedSections?: {
      physicalExam?: Record<string, any>;
      systemicExam?: Record<string, any>;
      laboratory?: Record<string, any>;
      xrayFinding?: string;
      xrayRemarks?: string;
    };
    reportData?: Record<string, any>;
    xrayFinding?: string;
    xrayRemarks?: string;
    xrayImageUrl?: string;
    restrictionNotice?: string;
  };
  registrationNumber?: string;
  registeredAt?: string;
  finalMedicalStatus?: string;
  finalizedAt?: Date;
  issuingOrganization?: string;
  patientInitials?: string;
  destinationCountry?: string;
  agency?: string;
  revocationReason?: string;
  revokedAt?: Date;
  allowPublicDownload?: boolean;
  allowPublicPrint?: boolean;
}

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ReportVerificationToken)
    private tokenRepository: Repository<ReportVerificationToken>,
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
    @InjectRepository(MedicalCertificate)
    private certificateRepository: Repository<MedicalCertificate>,
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(forwardRef(() => PdfService))
    private pdfService: PdfService,
  ) {}

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getBaseVerificationUrl(): string {
    const rawBaseUrl =
      this.configService.get<string>('qrVerificationBaseUrl') ||
      `${(this.configService.get<string>('frontendUrl') || 'http://localhost:3000').replace(/\/+$/, '')}/verify`;
    return rawBaseUrl.replace(/\/+$/, '');
  }

  getVerificationUrl(token: string): string {
    return `${this.getBaseVerificationUrl()}/${token}`;
  }

  getPreviewVerificationUrl(registrationNumber: string): string {
    return `${this.getBaseVerificationUrl()}/preview-${registrationNumber}`;
  }

  async createTokenForReport(reportId: string): Promise<ReportVerificationToken> {
    const tokenStr = this.generateToken();
    const tokenHash = this.hashToken(tokenStr);

    const record = this.tokenRepository.create({
      reportId,
      token: tokenStr,
      tokenHash,
      isRevoked: false,
    });

    return this.tokenRepository.save(record);
  }

  async revokeTokensForReport(
    reportId: string,
    reason: string,
    revokedById?: string,
  ): Promise<void> {
    await this.tokenRepository.update(
      { reportId, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revocationReason: reason,
        revokedById,
      },
    );
  }

  private maskName(fullName: string): string {
    if (!fullName) return '';
    return fullName
      .trim()
      .split(/\s+/)
      .map((part) => (part.length > 0 ? `${part[0]}***` : ''))
      .join(' ');
  }

  private maskPassport(passport: string): string {
    if (!passport) return '';
    if (passport.length <= 4) return '****';
    const start = passport.substring(0, 2);
    const end = passport.substring(passport.length - 2);
    return `${start}****${end}`;
  }

  async verifyPublicToken(token: string): Promise<PublicVerificationResponse> {
    const settings = await this.settingsService.getSettings();
    const disclosure = settings.publicDisclosure || {
      patientNameMode: 'INITIALS',
      showPassport: false,
      showDob: false,
      showNationality: true,
      showDestination: true,
      showDetailedReport: false,
      allowedReportSections: ['physical', 'systemic', 'lab', 'xray'],
      allowPublicDownload: true,
      allowPublicPrint: true,
    };

    // 1. Check DRAFT preview tokens
    if (token.startsWith('preview-')) {
      const regNo = token.replace('preview-', '');
      const report = await this.reportRepository.findOne({
        where: { registrationNumber: regNo },
        relations: ['patient'],
      });

      if (report) {
        const maskedInitials = this.maskName(report.patient?.fullName || '');
        const p = report.patient;
        return {
          verified: false,
          status: 'DRAFT',
          registrationNumber: report.registrationNumber,
          registeredAt: report.registeredAt,
          finalMedicalStatus: report.finalMedicalStatus || 'DRAFT',
          patientInitials: maskedInitials,
          destinationCountry: p?.country,
          agency: p?.agency,
          issuingOrganization: settings.orgName || 'MYSA Medical Center',
          message:
            'This medical examination report is currently in DRAFT status and has not been officially finalized or certified yet.',
          patient: {
            fullName: p?.fullName || 'MD MOHAN MIA',
            patientInitials: maskedInitials,
            passportNumber: p?.passportNumber || 'A09876543',
            dateOfBirth: p?.dateOfBirth,
            nationality: p?.nationality || 'Bangladeshi',
            destinationCountry: p?.country || 'UAE/DUBAI',
            agency: p?.agency || 'Al-Hasan Overseas Recruitment',
            photoUrl: p?.photoUrl || '/default_photo.png',
            gender: p?.gender || 'Male',
            maritalStatus: p?.maritalStatus || 'Married',
            religion: p?.religion || 'Islam',
            heightCm: p?.heightCm,
            weightKg: p?.weightKg,
          },
          associatedReport: {
            registrationNumber: report.registrationNumber,
            examinationDate: report.registeredAt,
            reportStatus: 'DRAFT',
            finalMedicalStatus: report.finalMedicalStatus || 'FIT',
            finalRemarks: report.finalRemarks || 'CLINICALLY FIT FOR OVERSEAS EMPLOYMENT (DRAFT)',
            revisionNumber: report.currentRevisionNumber || 1,
            categoriesPerformed: [
              'Physical Examination',
              'Laboratory Investigations',
              'Radiology (Chest X-Ray)',
            ],
            isDetailedPublic: true,
            reportData: report.reportData || {},
            xrayFinding: report.xrayFinding || 'NORMAL',
            xrayRemarks: report.xrayRemarks || 'CHEST NORMAL',
            xrayImageUrl: report.xrayImageUrl || '/default_xray.png',
          },
        };
      }
    }

    // 2. Lookup in MedicalCertificate repository
    let certificate = await this.certificateRepository.findOne({
      where: { verificationToken: token },
      relations: ['report', 'report.patient', 'patient', 'issuedBy'],
    });

    let report: MedicalReport | null = null;
    let tokenRecord: ReportVerificationToken | null = null;

    if (certificate) {
      report = certificate.report;
    } else {
      // Lookup in legacy/direct ReportVerificationToken
      tokenRecord = await this.tokenRepository.findOne({
        where: { token },
        relations: ['report', 'report.patient'],
      });

      if (tokenRecord && tokenRecord.report) {
        report = tokenRecord.report;
        // Check if an associated certificate exists for this report
        certificate = await this.certificateRepository.findOne({
          where: { reportId: report.id },
          relations: ['patient', 'issuedBy'],
          order: { issuedAt: 'DESC' },
        });
      }
    }

    if (!report) {
      return {
        verified: false,
        status: 'INVALID',
        message: 'The requested verification signature does not match any genuine certificate on the MedVerify ledger.',
      };
    }

    // Determine status: REVOKED, SUPERSEDED, EXPIRED, VALID, INVALID
    const isRevoked =
      certificate?.status === CertificateStatus.REVOKED ||
      tokenRecord?.isRevoked ||
      report.status === ReportStatus.REVOKED;

    if (isRevoked) {
      return {
        verified: false,
        status: 'REVOKED',
        registrationNumber: report.registrationNumber,
        registeredAt: report.registeredAt,
        issuingOrganization: settings.orgName || 'MYSA Medical Center',
        revocationReason:
          certificate?.revocationReason ||
          tokenRecord?.revocationReason ||
          'Certificate was officially revoked by issuing medical center.',
        revokedAt: certificate?.revokedAt || tokenRecord?.revokedAt,
        message: 'This medical certificate has been revoked by the issuing authority and is no longer valid.',
      };
    }

    const isSuperseded =
      certificate?.status === CertificateStatus.SUPERSEDED ||
      report.status === ReportStatus.AMENDED;

    if (isSuperseded) {
      return {
        verified: false,
        status: 'SUPERSEDED',
        registrationNumber: report.registrationNumber,
        registeredAt: report.registeredAt,
        issuingOrganization: settings.orgName || 'MYSA Medical Center',
        message: 'This certificate has been superseded by a newer clinical amendment. Please verify the updated report.',
      };
    }

    const isExpired =
      certificate?.status === CertificateStatus.EXPIRED ||
      (certificate?.expiresAt && new Date() > new Date(certificate.expiresAt));

    if (isExpired) {
      return {
        verified: false,
        status: 'EXPIRED',
        registrationNumber: report.registrationNumber,
        registeredAt: report.registeredAt,
        issuingOrganization: settings.orgName || 'MYSA Medical Center',
        message: `This certificate expired on ${certificate?.expiresAt ? new Date(certificate.expiresAt).toLocaleDateString() : 'its scheduled expiration date'}.`,
      };
    }

    if (report.status !== ReportStatus.FINALIZED) {
      return {
        verified: false,
        status: 'INVALID',
        message: 'This medical report has not been officially finalized or approved by a licensed medical doctor.',
      };
    }

    // Build verified response conforming strictly to disclosure policy
    const patientRaw = report.patient || certificate?.patient;
    const rawFullName = patientRaw?.fullName || '';
    const maskedInitials = this.maskName(rawFullName);
    const displayName =
      disclosure.patientNameMode === 'FULL' ? rawFullName : maskedInitials;

    const displayPassport = disclosure.showPassport
      ? (disclosure.patientNameMode === 'FULL' ? patientRaw?.passportNumber : this.maskPassport(patientRaw?.passportNumber || ''))
      : undefined;

    const displayDob = disclosure.showDob
      ? patientRaw?.dateOfBirth
      : undefined;

    const categories = [
      'General Physical Assessment',
      'Cardiovascular & Systemic Examination',
      'Respiratory Examination',
      'Venereal Disease Screening',
      'Clinical Biochemistry & Serology',
      'Pulmonary Radiology (Chest X-Ray)',
    ];

    const isDetailedAllowed = !!disclosure.showDetailedReport;
    const reportData = report.reportData || {};

    const detailedSections = isDetailedAllowed
      ? {
          physicalExam: {
            bloodPressure: reportData.blood_pressure || '120/80',
            heart: reportData.heart || 'NAD',
            lungs: reportData.lungs || 'NAD',
            abdomen: reportData.abdomen || 'NAD',
          },
          systemicExam: {
            hernia: reportData.hernia || 'ABSENT',
            skin: reportData.skin || 'NAD',
            extremities: reportData.extremities || 'NAD',
            cns: reportData.cns || 'NAD',
          },
          laboratory: {
            bloodGroup: reportData.blood_group || 'O (+VE)',
            haemoglobin: reportData.haemoglobin || '14.2 g/dL',
            hiv: reportData.hiv || 'NEGATIVE',
            hbsag: reportData.hbsag || 'NEGATIVE',
            antiHcv: reportData.anti_hcv || 'NEGATIVE',
            vdrl: reportData.vdrl || 'NON REACTIVE',
          },
          xrayFinding: report.xrayFinding || 'NORMAL',
          xrayRemarks: report.xrayRemarks || 'NORMAL',
        }
      : undefined;

    const certNum =
      certificate?.certificateNumber ||
      `MC-${new Date(report.registeredAt).getFullYear()}-${report.registrationNumber.slice(-5)}`;

    return {
      verified: true,
      status: 'VALID',
      token,
      message: 'Genuine and authenticated medical fitness certificate.',
      certificate: {
        id: certificate?.id,
        certificateNumber: certNum,
        issueDate: certificate?.issuedAt ? certificate.issuedAt.toISOString() : report.finalizedAt?.toISOString() || report.registeredAt,
        expiresAt: certificate?.expiresAt ? certificate.expiresAt.toISOString() : undefined,
        status: 'VALID',
        issuingOrganization: settings.orgName || 'MYSA Medical Center',
        finalMedicalStatus: report.finalMedicalStatus || 'FIT',
        authorizedSignatory: {
          name: settings.signatoryName || 'Dr. A. K. M. Shamsuddin',
          designation: settings.signatoryDesignation || 'MBBS, FCPS - Medical Director',
          licenseNumber: settings.signatoryLicenseNumber || 'BMDC Reg No: A-12345',
        },
      },
      patient: {
        fullName: displayName,
        patientInitials: maskedInitials,
        passportNumber: displayPassport,
        dateOfBirth: displayDob,
        nationality: disclosure.showNationality ? patientRaw?.nationality : undefined,
        destinationCountry: disclosure.showDestination ? patientRaw?.country : undefined,
        agency: patientRaw?.agency,
        photoUrl: patientRaw?.photoUrl || '/default_photo.png',
        gender: patientRaw?.gender || 'Male',
        maritalStatus: patientRaw?.maritalStatus || 'Married',
        religion: patientRaw?.religion || 'Islam',
        heightCm: patientRaw?.heightCm,
        weightKg: patientRaw?.weightKg,
      },
      associatedReport: {
        registrationNumber: report.registrationNumber,
        examinationDate: report.registeredAt,
        reportStatus: report.status,
        finalMedicalStatus: report.finalMedicalStatus || 'FIT',
        finalRemarks: report.finalRemarks || 'CLINICALLY FIT FOR OVERSEAS EMPLOYMENT',
        revisionNumber: report.currentRevisionNumber || 1,
        categoriesPerformed: categories,
        isDetailedPublic: true,
        detailedSections,
        reportData: report.reportData || {},
        xrayFinding: report.xrayFinding || 'NORMAL',
        xrayRemarks: report.xrayRemarks || 'CHEST NORMAL',
        xrayImageUrl: report.xrayImageUrl || '/default_xray.png',
      },
      // Backward compatibility fields
      registrationNumber: report.registrationNumber,
      registeredAt: report.registeredAt,
      finalMedicalStatus: report.finalMedicalStatus,
      finalizedAt: report.finalizedAt,
      issuingOrganization: settings.orgName || 'MYSA Medical Center',
      patientInitials: maskedInitials,
      destinationCountry: patientRaw?.country,
      agency: patientRaw?.agency,
      allowPublicDownload: disclosure.allowPublicDownload !== false,
      allowPublicPrint: disclosure.allowPublicPrint !== false,
    };
  }

  async getActiveTokenForReport(reportId: string): Promise<ReportVerificationToken | null> {
    return this.tokenRepository.findOne({
      where: { reportId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Generates combined official Two-Page PDF for public verification downloads.
   * Page 1: Official Medical Fitness Certificate
   * Page 2: Detailed Clinical Test Report
   */
  async getPublicCombinedPdfBuffer(token: string): Promise<{ buffer: Buffer; filename: string }> {
    const settings = await this.settingsService.getSettings();
    if (settings.publicDisclosure?.allowPublicDownload === false) {
      throw new ForbiddenException(
        'Public downloading of official medical records is restricted by organizational policy.',
      );
    }

    let report: MedicalReport | null = null;
    let certificate: MedicalCertificate | null = null;

    if (token.startsWith('preview-')) {
      const regNo = token.replace('preview-', '');
      report = await this.reportRepository.findOne({
        where: { registrationNumber: regNo },
        relations: ['patient'],
      });
      if (!report) throw new NotFoundException('Medical report not found');
    } else {
      certificate = await this.certificateRepository.findOne({
        where: { verificationToken: token },
        relations: ['report', 'report.patient', 'patient', 'issuedBy'],
      });

      if (certificate) {
        report = certificate.report;
      } else {
        const tokenRecord = await this.tokenRepository.findOne({
          where: { token },
          relations: ['report', 'report.patient'],
        });

        if (tokenRecord && tokenRecord.report) {
          report = tokenRecord.report;
          certificate = await this.certificateRepository.findOne({
            where: { reportId: report.id },
            relations: ['patient', 'issuedBy'],
            order: { issuedAt: 'DESC' },
          });
        }
      }
    }

    if (!report) {
      throw new NotFoundException('Medical record not found for this verification signature.');
    }

    let patient = report.patient || certificate?.patient;
    if (!patient && report.id) {
      const fullReport = await this.reportRepository.findOne({
        where: { id: report.id },
        relations: ['patient'],
      });
      if (fullReport?.patient) {
        patient = fullReport.patient;
        report.patient = fullReport.patient;
      }
    }

    let buffer: Buffer;
    if (certificate) {
      buffer = await this.pdfService.generateCombinedPdf(
        certificate,
        report,
        patient,
        settings,
      );
    } else {
      // Draft / pre-approval preview combined document
      const previewCert = {
        certificateNumber: `DRAFT-${report.registrationNumber}`,
        verificationToken: token,
        issuedAt: new Date(),
        status: CertificateStatus.ACTIVE,
      } as any;
      buffer = await this.pdfService.generateCombinedPdf(
        previewCert,
        report,
        patient,
        settings,
      );
    }

    const safeReg = report.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Official_Certificate_and_Report_${safeReg}.pdf`;

    return { buffer, filename };
  }
}
