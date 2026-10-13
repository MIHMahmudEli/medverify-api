import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { MedicalReport, ReportStatus } from '../../database/entities/medical-report.entity';
import { ConfigService } from '@nestjs/config';

export interface PublicVerificationResponse {
  verified: boolean;
  status: 'VALID' | 'REVOKED' | 'SUPERSEDED' | 'INVALID';
  message?: string;
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
}

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ReportVerificationToken)
    private tokenRepository: Repository<ReportVerificationToken>,
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
    private configService: ConfigService,
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

  async verifyPublicToken(token: string): Promise<PublicVerificationResponse> {
    if (token.startsWith('preview-')) {
      const regNo = token.replace('preview-', '');
      const report = await this.reportRepository.findOne({
        where: { registrationNumber: regNo },
        relations: ['patient'],
      });
      if (report) {
        return {
          verified: false,
          status: 'INVALID',
          registrationNumber: report.registrationNumber,
          registeredAt: report.registeredAt,
          destinationCountry: report.patient?.country,
          agency: report.patient?.agency,
          issuingOrganization: 'MYSA Medical Center',
          message: 'This medical report is currently in DRAFT status and has not been officially finalized or certified yet.',
        };
      }
    }

    const tokenRecord = await this.tokenRepository.findOne({
      where: { token },
      relations: ['report', 'report.patient'],
    });

    if (!tokenRecord || !tokenRecord.report) {
      return {
        verified: false,
        status: 'INVALID',
        message: 'The requested verification token is invalid or has expired.',
      };
    }

    const report = tokenRecord.report;

    if (tokenRecord.isRevoked || report.status === ReportStatus.REVOKED) {
      return {
        verified: false,
        status: 'REVOKED',
        registrationNumber: report.registrationNumber,
        registeredAt: report.registeredAt,
        issuingOrganization: 'MYSA Medical Center',
        revocationReason: tokenRecord.revocationReason || 'Report has been officially revoked',
        revokedAt: tokenRecord.revokedAt,
        message: 'This medical certificate has been revoked by the issuing authority.',
      };
    }

    if (report.status === ReportStatus.AMENDED) {
      return {
        verified: false,
        status: 'SUPERSEDED',
        registrationNumber: report.registrationNumber,
        registeredAt: report.registeredAt,
        issuingOrganization: 'MYSA Medical Center',
        message: 'This report has been amended. A newer revision has been issued.',
      };
    }

    if (report.status !== ReportStatus.FINALIZED) {
      return {
        verified: false,
        status: 'INVALID',
        message: 'This report has not yet been finalized.',
      };
    }

    // Mask patient full name to initials only for privacy
    const rawName = report.patient?.fullName || '';
    const nameParts = rawName.trim().split(/\s+/);
    const maskedInitials = nameParts
      .map((part) => (part.length > 0 ? `${part[0]}***` : ''))
      .join(' ');

    return {
      verified: true,
      status: 'VALID',
      registrationNumber: report.registrationNumber,
      registeredAt: report.registeredAt,
      finalMedicalStatus: report.finalMedicalStatus,
      finalizedAt: report.finalizedAt,
      issuingOrganization: 'MYSA Medical Center',
      patientInitials: maskedInitials,
      destinationCountry: report.patient?.country,
      agency: report.patient?.agency,
      message: 'Medical test report is genuine and active.',
    };
  }

  async getActiveTokenForReport(reportId: string): Promise<ReportVerificationToken | null> {
    return this.tokenRepository.findOne({
      where: { reportId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
  }
}
