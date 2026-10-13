import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CertificatesService } from './certificates.service';
import { MedicalCertificate, CertificateStatus } from '../../database/entities/medical-certificate.entity';
import { MedicalReport, ReportStatus, MedicalFitnessStatus } from '../../database/entities/medical-report.entity';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { SettingsService } from '../settings/settings.service';
import { PdfService } from '../pdf/pdf.service';
import { AuditService } from '../audit/audit.service';
import { VerificationService } from '../verification/verification.service';
import { BadRequestException } from '@nestjs/common';

describe('CertificatesService', () => {
  let service: CertificatesService;
  let mockCertRepo: any;
  let mockReportRepo: any;
  let mockTokenRepo: any;
  let mockSettingsService: any;
  let mockPdfService: any;
  let mockAuditService: any;
  let mockVerificationService: any;

  beforeEach(async () => {
    mockCertRepo = {
      count: jest.fn().mockResolvedValue(10),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((cert) => Promise.resolve({ id: 'cert-uuid-1', ...cert })),
    };
    mockReportRepo = {
      findOne: jest.fn(),
    };
    mockTokenRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((tok) => Promise.resolve(tok)),
      update: jest.fn(),
    };
    mockSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        orgName: 'MYSA Medical Center',
        certificateTitle: 'MEDICAL FITNESS CERTIFICATE',
        certificateNumberPrefix: 'MC',
        certificateValidityDays: 90,
      }),
    };
    mockPdfService = {
      generateCertificatePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock cert')),
      generateCombinedPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock combined')),
    };
    mockAuditService = {
      log: jest.fn().mockResolvedValue({}),
    };
    mockVerificationService = {
      generateToken: jest.fn().mockReturnValue('mock-token-64-chars'),
      hashToken: jest.fn().mockReturnValue('mock-hash-64-chars'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        {
          provide: getRepositoryToken(MedicalCertificate),
          useValue: mockCertRepo,
        },
        {
          provide: getRepositoryToken(MedicalReport),
          useValue: mockReportRepo,
        },
        {
          provide: getRepositoryToken(ReportVerificationToken),
          useValue: mockTokenRepo,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: PdfService,
          useValue: mockPdfService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
  });

  it('should issue a medical certificate when report is finalized and fit', async () => {
    mockReportRepo.findOne.mockResolvedValue({
      id: 'rep-1',
      status: ReportStatus.FINALIZED,
      finalMedicalStatus: MedicalFitnessStatus.FIT,
      registrationNumber: 'MMS2610101',
      registeredAt: '2026-10-14',
      patient: {
        id: 'pat-1',
        fullName: 'MD MOHAN',
        passportNumber: 'A01234567',
      },
      revisions: [],
    });

    const cert = await service.issueCertificate('rep-1', { id: 'doc-1' } as any);

    expect(cert).toBeDefined();
    expect(cert.certificateNumber).toMatch(/^MC-\d{4}-\d{5}$/);
    expect(cert.status).toBe(CertificateStatus.ACTIVE);
    expect(cert.verificationToken).toBe('mock-token-64-chars');
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CERTIFICATE_ISSUED' }),
    );
  });

  it('should reject issuance if report is not finalized', async () => {
    mockReportRepo.findOne.mockResolvedValue({
      id: 'rep-draft',
      status: ReportStatus.DRAFT,
      finalMedicalStatus: MedicalFitnessStatus.FIT,
      patient: {},
    });

    await expect(
      service.issueCertificate('rep-draft', { id: 'doc-1' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should revoke an active certificate and record audit log', async () => {
    mockCertRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      certificateNumber: 'MC-2026-00011',
      status: CertificateStatus.ACTIVE,
      verificationToken: 'token-to-revoke',
    });

    const res = await service.revokeCertificate('cert-1', 'Suspected fraud', { id: 'admin-1' } as any);
    expect(res.status).toBe(CertificateStatus.REVOKED);
    expect(res.revocationReason).toBe('Suspected fraud');
    expect(mockTokenRepo.update).toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CERTIFICATE_REVOKED' }),
    );
  });
});
