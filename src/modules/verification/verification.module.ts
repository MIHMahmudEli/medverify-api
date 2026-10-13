import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { VerificationService } from './verification.service';
import { PublicVerificationController } from './public-verification.controller';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportVerificationToken,
      MedicalReport,
      MedicalCertificate,
    ]),
    ConfigModule,
    SettingsModule,
  ],
  controllers: [PublicVerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
