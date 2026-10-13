import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { VerificationService } from '../verification/verification.service';
import {
  MedicalReport,
  ReportStatus,
  MedicalFitnessStatus,
} from '../../database/entities/medical-report.entity';
import { Patient } from '../../database/entities/patient.entity';

describe('PdfService', () => {
  let service: PdfService;
  let mockVerificationService: any;

  beforeEach(async () => {
    mockVerificationService = {
      getActiveTokenForReport: jest.fn().mockResolvedValue({
        id: 'tok-1',
        token: 'test-token',
        isRevoked: false,
      }),
      getVerificationUrl: jest.fn().mockReturnValue('http://localhost:3000/verify/test-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: VerificationService,
          useValue: mockVerificationService,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('should generate a valid PDF buffer with report headers and QR code', async () => {
    const mockReport: Partial<MedicalReport> = {
      id: 'rep-1',
      registrationNumber: 'MMS2509341',
      registeredAt: '2025-09-14',
      status: ReportStatus.FINALIZED,
      finalMedicalStatus: MedicalFitnessStatus.FIT,
      finalRemarks: 'NORMAL',
      currentRevisionNumber: 1,
      xrayFinding: 'NORMAL',
      xrayRemarks: 'NORMAL',
      reportData: {
        blood_pressure: '120/80',
        heart: 'NAD',
        rbs: '5.8',
        hiv: 'NEGATIVE',
      },
    };

    const mockPatient: Partial<Patient> = {
      id: 'pat-1',
      fullName: 'MD MOHAN',
      passportNumber: 'A00678003',
      dateOfBirth: '2003-07-03',
      gender: 'Male',
      nationality: 'Bangladeshi',
      country: 'UAE/DUBAI',
      heightCm: 172,
      weightKg: 54,
    };

    const pdfBuffer = await service.generateReportPdf(
      mockReport as MedicalReport,
      mockPatient as Patient,
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000); // Standard PDF header & content
    // PDF Magic number %PDF-
    expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
