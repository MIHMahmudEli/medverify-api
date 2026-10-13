import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { VerificationService } from './verification.service';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { MedicalReport, ReportStatus, MedicalFitnessStatus } from '../../database/entities/medical-report.entity';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { SettingsService } from '../settings/settings.service';
import { PdfService } from '../pdf/pdf.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let mockTokenRepo: any;
  let mockReportRepo: any;
  let mockCertRepo: any;
  let mockSettingsService: any;

  beforeEach(async () => {
    mockTokenRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((token) => Promise.resolve({ id: 'tok-1', ...token })),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    mockReportRepo = {
      findOne: jest.fn(),
    };
    mockCertRepo = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(10),
      create: jest.fn((dto) => dto),
      save: jest.fn((cert) => Promise.resolve({ id: 'cert-1', ...cert })),
    };
    mockSettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        orgName: 'MYSA Medical Center',
        certificateTitle: 'MEDICAL FITNESS CERTIFICATE',
        publicDisclosure: {
          patientNameMode: 'INITIALS',
          showPassport: false,
          showDob: false,
          showNationality: true,
          showDestination: true,
          showDetailedReport: false,
          allowedReportSections: ['physical', 'systemic', 'lab', 'xray'],
          allowPublicDownload: true,
          allowPublicPrint: true,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(ReportVerificationToken),
          useValue: mockTokenRepo,
        },
        {
          provide: getRepositoryToken(MedicalReport),
          useValue: mockReportRepo,
        },
        {
          provide: getRepositoryToken(MedicalCertificate),
          useValue: mockCertRepo,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000/verify'),
          },
        },
        {
          provide: PdfService,
          useValue: {
            generateCombinedPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock combined')),
            generateReportPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock report')),
          },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  it('should generate high entropy cryptographically secure tokens', () => {
    const t1 = service.generateToken();
    const t2 = service.generateToken();
    expect(t1).toHaveLength(64); // 32 bytes hex
    expect(t2).toHaveLength(64);
    expect(t1).not.toEqual(t2);
  });

  it('should mask patient full name to initials only on public verification', async () => {
    mockCertRepo.findOne.mockResolvedValue(null);
    mockTokenRepo.findOne.mockResolvedValue({
      id: 'tok-1',
      token: 'sample-token',
      isRevoked: false,
      report: {
        registrationNumber: 'MMS2509341',
        status: ReportStatus.FINALIZED,
        finalMedicalStatus: MedicalFitnessStatus.FIT,
        registeredAt: '2025-09-14',
        patient: {
          fullName: 'MD MOHAN',
          passportNumber: 'A00678003',
          country: 'UAE/DUBAI',
        },
      },
    });

    const res = await service.verifyPublicToken('sample-token');
    expect(res.verified).toBe(true);
    expect(res.status).toBe('VALID');
    expect(res.registrationNumber).toBe('MMS2509341');
    expect(res.patientInitials).toBe('M*** M***');
    // Ensure sensitive fields are not leaked when disclosure is disabled
    expect(res.patient?.passportNumber).toBeUndefined();
    expect((res as any).reportData).toBeUndefined();
  });

  it('should return REVOKED status when token or report is revoked', async () => {
    mockCertRepo.findOne.mockResolvedValue(null);
    mockTokenRepo.findOne.mockResolvedValue({
      id: 'tok-1',
      token: 'revoked-token',
      isRevoked: true,
      revocationReason: 'Suspected tampering',
      revokedAt: new Date(),
      report: {
        registrationNumber: 'MMS2509341',
        status: ReportStatus.REVOKED,
        registeredAt: '2025-09-14',
        patient: { fullName: 'TEST PATIENT' },
      },
    });

    const res = await service.verifyPublicToken('revoked-token');
    expect(res.verified).toBe(false);
    expect(res.status).toBe('REVOKED');
    expect(res.revocationReason).toBe('Suspected tampering');
  });

  it('should return INVALID when token does not exist', async () => {
    mockCertRepo.findOne.mockResolvedValue(null);
    mockTokenRepo.findOne.mockResolvedValue(null);
    const res = await service.verifyPublicToken('non-existent-token');
    expect(res.verified).toBe(false);
    expect(res.status).toBe('INVALID');
  });
});
