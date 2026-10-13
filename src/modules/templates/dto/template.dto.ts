import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateSchema } from '../../../database/entities/report-template-version.entity';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Standard Overseas Medical Test' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'STANDARD_MMS_V1' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Standard diagnostic protocol for overseas employment' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsObject()
  schema: TemplateSchema;
}

export class CreateTemplateVersionDto {
  @ApiProperty()
  @IsObject()
  schema: TemplateSchema;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
