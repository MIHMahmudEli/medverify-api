import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  User,
  Patient,
  ReportTemplate,
  ReportTemplateVersion,
  MedicalReport,
  MedicalReportRevision,
  ReportVerificationToken,
  AuditLog,
  OrganizationSettings,
  MedicalCertificate,
} from '../database/entities';
import configuration from './configuration';

const config = configuration();

export const entityList = [
  User,
  Patient,
  ReportTemplate,
  ReportTemplateVersion,
  MedicalReport,
  MedicalReportRevision,
  ReportVerificationToken,
  AuditLog,
  OrganizationSettings,
  MedicalCertificate,
];

export const typeOrmModuleOptions: TypeOrmModuleOptions = {
  type: 'postgres',
  url: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: entityList,
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true' || config.nodeEnv === 'development',
  logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  extra: {
    max: 10,
    connectionTimeoutMillis: 10000,
  },
};

export const AppDataSource = new DataSource({
  ...typeOrmModuleOptions,
} as DataSourceOptions);
