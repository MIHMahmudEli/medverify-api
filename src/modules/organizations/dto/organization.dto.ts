import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CertificateFieldsConfig,
  PublicDisclosureConfig,
} from '../../../database/entities/organization-settings.entity';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'MYSA Medical Center' })
  @IsString()
  @IsNotEmpty()
  orgName: string;

  @ApiProperty({ example: 'MMS' })
  @IsString()
  @IsNotEmpty()
  orgCode: string;

  @ApiProperty({ example: 'Diagnostic & Medical Checkup Centre for Overseas Employment' })
  @IsString()
  @IsNotEmpty()
  orgAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgAddressLine2?: string;

  @ApiPropertyOptional({ example: '+880 1700-000000' })
  @IsOptional()
  @IsString()
  orgPhone?: string;

  @ApiPropertyOptional({ example: 'info@mysamedicalbd.com' })
  @IsOptional()
  @IsString()
  orgEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ default: 'MEDICAL TEST REPORT' })
  @IsOptional()
  @IsString()
  reportHeaderTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disclaimerText?: string;

  @ApiPropertyOptional({ default: 'MEDICAL FITNESS CERTIFICATE' })
  @IsOptional()
  @IsString()
  certificateTitle?: string;

  @ApiPropertyOptional({ default: 'MC' })
  @IsOptional()
  @IsString()
  certificateNumberPrefix?: string;

  @ApiPropertyOptional({ default: 'Dr. A. K. M. Shamsuddin' })
  @IsOptional()
  @IsString()
  signatoryName?: string;

  @ApiPropertyOptional({ default: 'MBBS, FCPS - Medical Director' })
  @IsOptional()
  @IsString()
  signatoryDesignation?: string;

  @ApiPropertyOptional({ default: 'BMDC Reg No: A-12345' })
  @IsOptional()
  @IsString()
  signatoryLicenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatorySignatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateFooter?: string;

  @ApiPropertyOptional({ default: 90 })
  @IsOptional()
  @IsNumber()
  certificateValidityDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  certificateFields?: CertificateFieldsConfig;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  publicDisclosure?: PublicDisclosureConfig;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgAddressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportHeaderTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disclaimerText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateNumberPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatoryName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatoryDesignation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatoryLicenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatorySignatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateFooter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  certificateValidityDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  certificateFields?: CertificateFieldsConfig;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  publicDisclosure?: PublicDisclosureConfig;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
