import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export interface CertificateFieldsConfig {
  showPassport: boolean;
  showDob: boolean;
  showNationality: boolean;
  showDestination: boolean;
  showDoctorDetails: boolean;
}

export interface PublicDisclosureConfig {
  patientNameMode: 'FULL' | 'INITIALS';
  showPassport: boolean;
  showDob: boolean;
  showNationality: boolean;
  showDestination: boolean;
  showDetailedReport: boolean;
  allowedReportSections: string[];
  allowPublicDownload: boolean;
  allowPublicPrint: boolean;
}

@Entity('organization_settings')
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'MYSA Medical Center' })
  orgName: string;

  @Column({ type: 'varchar', length: 50, default: 'MMS' })
  orgCode: string;

  @Column({ type: 'text', default: 'Diagnostic & Medical Checkup Centre for Overseas Employment' })
  orgAddress: string;

  @Column({ type: 'text', nullable: true, default: 'VIP Road, Dhaka-1000' })
  orgAddressLine2?: string;

  @Column({ type: 'varchar', length: 255, default: '+880 1700-000000' })
  orgPhone: string;

  @Column({ type: 'varchar', length: 100, default: 'info@medverify.com' })
  orgEmail: string;

  @Column({ type: 'text', nullable: true })
  logoUrl?: string;

  @Column({ type: 'varchar', length: 255, default: 'MEDICAL TEST REPORT' })
  reportHeaderTitle: string;

  @Column({
    type: 'text',
    default: 'This is an auto generated report, does not require any signature.',
  })
  disclaimerText: string;

  // --- Official Certificate Settings ---
  @Column({ type: 'varchar', length: 255, default: 'MEDICAL FITNESS CERTIFICATE' })
  certificateTitle: string;

  @Column({ type: 'varchar', length: 50, default: 'MC' })
  certificateNumberPrefix: string;

  @Column({ type: 'varchar', length: 255, default: 'Dr. A. K. M. Shamsuddin' })
  signatoryName: string;

  @Column({ type: 'varchar', length: 255, default: 'MBBS, FCPS - Medical Director' })
  signatoryDesignation: string;

  @Column({ type: 'varchar', length: 100, default: 'BMDC Reg No: A-12345' })
  signatoryLicenseNumber: string;

  @Column({ type: 'text', nullable: true })
  signatorySignatureUrl?: string;

  @Column({
    type: 'text',
    default: 'This official certificate verifies fitness for overseas employment. Authenticate online using the security QR code.',
  })
  certificateFooter: string;

  @Column({ type: 'integer', nullable: true, default: 90 })
  certificateValidityDays: number | null;

  @Column({
    type: 'jsonb',
    default: {
      showPassport: true,
      showDob: true,
      showNationality: true,
      showDestination: true,
      showDoctorDetails: true,
    },
  })
  certificateFields: CertificateFieldsConfig;

  @Column({
    type: 'jsonb',
    default: {
      patientNameMode: 'INITIALS',
      showPassport: false,
      showDob: false,
      showNationality: true,
      showDestination: true,
      showDetailedReport: false,
      allowedReportSections: ['physical', 'systemic', 'lab', 'xray'],
      allowPublicDownload: true,
      allowPublicPrint: true,
    },
  })
  publicDisclosure: PublicDisclosureConfig;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
