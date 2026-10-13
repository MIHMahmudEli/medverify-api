import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { SettingsModule } from '../settings/settings.module';
import { PdfModule } from '../pdf/pdf.module';
import { AuditModule } from '../audit/audit.module';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalCertificate,
      MedicalReport,
      ReportVerificationToken,
    ]),
    SettingsModule,
    forwardRef(() => PdfModule),
    AuditModule,
    forwardRef(() => VerificationModule),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
