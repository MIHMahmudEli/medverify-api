import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalReport, ReportStatus } from '../../database/entities/medical-report.entity';
import { Patient } from '../../database/entities/patient.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(MedicalReport)
    private reportRepository: Repository<MedicalReport>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async getMetrics() {
    const [
      totalPatients,
      totalReports,
      draftReports,
      reviewReports,
      finalizedReports,
      recentReports,
    ] = await Promise.all([
      this.patientRepository.count({ where: { isArchived: false } }),
      this.reportRepository.count(),
      this.reportRepository.count({ where: { status: ReportStatus.DRAFT } }),
      this.reportRepository.count({ where: { status: ReportStatus.IN_REVIEW } }),
      this.reportRepository.count({ where: { status: ReportStatus.FINALIZED } }),
      this.reportRepository.find({
        relations: ['patient', 'finalizedBy'],
        order: { createdAt: 'DESC' },
        take: 7,
      }),
    ]);

    return {
      metrics: {
        totalPatients,
        totalReports,
        draftReports,
        reviewReports,
        finalizedReports,
      },
      recentReports,
    };
  }
}
