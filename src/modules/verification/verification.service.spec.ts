import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { VerificationService } from './verification.service';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { MedicalReport, ReportStatus, MedicalFitnessStatus } from '../../database/entities/medical-report.entity';

describe('VerificationService', () => {
  let service: VerificationService;
  let mockTokenRepo: any;
  let mockReportRepo: any;

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
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000/verify'),
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
    // Ensure sensitive fields are never leaked to public
    expect((res as any).passportNumber).toBeUndefined();
    expect((res as any).reportData).toBeUndefined();
  });

  it('should return REVOKED status when token or report is revoked', async () => {
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
    mockTokenRepo.findOne.mockResolvedValue(null);
    const res = await service.verifyPublicToken('non-existent-token');
    expect(res.verified).toBe(false);
    expect(res.status).toBe('INVALID');
  });
});
