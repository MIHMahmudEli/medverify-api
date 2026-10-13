import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { Patient } from '../../database/entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalReport, Patient])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
