import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
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
  UserRole,
} from '../entities';
import { entityList } from '../../config/typeorm.config';
import configuration from '../../config/configuration';

async function seed() {
  const config = configuration();
  console.log('Connecting to database for seed...');

  const dataSource = new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    entities: entityList,
    synchronize: true, // creates tables if they don't exist yet
  });

  await dataSource.initialize();
  console.log('Database connected & schema synchronized.');

  const userRepo = dataSource.getRepository(User);
  const settingsRepo = dataSource.getRepository(OrganizationSettings);

  // 1. Seed Organization Settings
  let settings = await settingsRepo.findOne({ where: {} });
  if (!settings) {
    settings = settingsRepo.create({
      orgName: 'MYSA Medical Center',
      orgCode: 'MMS',
      orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
      orgPhone: '+880 1700-000000',
      orgEmail: 'info@mysamedicalbd.com',
      reportHeaderTitle: 'MEDICAL TEST REPORT',
      disclaimerText: 'This is an auto generated report, does not require any signature.',
    });
    await settingsRepo.save(settings);
    console.log('Organization settings initialized.');
  }

  // 2. Seed Default Staff Accounts
  const usersToSeed = [
    {
      email: 'admin@medverify.com',
      fullName: 'System Administrator',
      password: 'AdminPassword123!',
      role: UserRole.SUPER_ADMIN,
      department: 'Administration',
    },
    {
      email: 'doctor@medverify.com',
      fullName: 'Dr. Sarah Rahman, MD',
      password: 'DoctorPassword123!',
      role: UserRole.DOCTOR,
      department: 'General Medicine & Radiology',
    },
    {
      email: 'operator@medverify.com',
      fullName: 'Report Operator Karim',
      password: 'OperatorPassword123!',
      role: UserRole.REPORT_OPERATOR,
      department: 'Data Operations',
    },
    {
      email: 'lab@medverify.com',
      fullName: 'Lab Tech Hasan',
      password: 'LabPassword123!',
      role: UserRole.LAB_TECHNICIAN,
      department: 'Pathology & Serology',
    },
  ];

  for (const u of usersToSeed) {
    const existing = await userRepo.findOne({ where: { email: u.email } });
    if (!existing) {
      const hash = await argon2.hash(u.password);
      const user = userRepo.create({
        email: u.email,
        fullName: u.fullName,
        passwordHash: hash,
        role: u.role,
        department: u.department,
        isActive: true,
      });
      await userRepo.save(user);
      console.log(`Seeded account: ${u.email} (${u.role})`);
    } else {
      console.log(`Account already exists: ${u.email}`);
    }
  }

  console.log('Seed completed successfully!');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
