import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { MedicalReportRevision } from '../../database/entities/medical-report-revision.entity';
import { Patient } from '../../database/entities/patient.entity';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';
import { ReportTemplatesModule } from '../templates/templates.module';
import { VerificationModule } from '../verification/verification.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalReport,
      MedicalReportRevision,
      Patient,
      MedicalCertificate,
      OrganizationSettings,
    ]),
    ReportTemplatesModule,
    VerificationModule,
    PdfModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
