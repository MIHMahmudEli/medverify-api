import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReportStatus,
  MedicalFitnessStatus,
} from '../../../database/entities/medical-report.entity';

export class CreateReportDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateVersionId?: string;

  @ApiPropertyOptional({ example: '2025-09-14' })
  @IsOptional()
  @IsDateString()
  registeredAt?: string;

  @ApiProperty({ description: 'Key-value map of report examination and lab data' })
  @IsObject()
  reportData: Record<string, any>;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsOptional()
  @IsString()
  xrayFinding?: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsOptional()
  @IsString()
  xrayRemarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fingerprintUrl?: string;
}

export class UpdateReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  registeredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reportData?: Record<string, any>;

  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayFinding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayRemarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fingerprintUrl?: string;
}

export class SubmitForReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FinalizeReportDto {
  @ApiProperty({ enum: MedicalFitnessStatus, example: MedicalFitnessStatus.FIT })
  @IsEnum(MedicalFitnessStatus)
  @IsNotEmpty()
  finalMedicalStatus: MedicalFitnessStatus;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsOptional()
  @IsString()
  finalRemarks?: string;
}

export class AmendReportDto {
  @ApiProperty({ description: 'Reason for amending finalized report' })
  @IsString()
  @IsNotEmpty()
  reasonForChange: string;

  @ApiProperty({ enum: MedicalFitnessStatus })
  @IsEnum(MedicalFitnessStatus)
  @IsNotEmpty()
  finalMedicalStatus: MedicalFitnessStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finalRemarks?: string;

  @ApiProperty({ description: 'Updated report fields' })
  @IsObject()
  reportData: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayFinding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xrayRemarks?: string;
}

export class RevokeReportDto {
  @ApiProperty({ description: 'Reason for revoking the report' })
  @IsString()
  @IsNotEmpty()
  revocationReason: string;
}
