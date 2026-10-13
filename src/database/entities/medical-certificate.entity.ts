import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalReport } from './medical-report.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { MedicalReportRevision } from './medical-report-revision.entity';

export enum CertificateStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  SUPERSEDED = 'SUPERSEDED',
  EXPIRED = 'EXPIRED',
}

@Entity('medical_certificates')
export class MedicalCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  certificateNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => MedicalReport, (report) => report.certificates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: MedicalReport;

  @Column({ type: 'uuid', nullable: true })
  reportRevisionId?: string;

  @ManyToOne(() => MedicalReportRevision, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportRevisionId' })
  reportRevision?: MedicalReportRevision;

  @Index()
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  verificationToken: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  verificationTokenHash?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.ACTIVE,
  })
  status: CertificateStatus;

  @Column({ type: 'timestamp with time zone' })
  issuedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  revokedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revokedById' })
  revokedBy?: User;

  @Column({ type: 'text', nullable: true })
  revocationReason?: string;

  @Column({ type: 'uuid' })
  issuedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issuedById' })
  issuedBy: User;

  @Column({ type: 'integer', default: 1 })
  approvedDisclosurePolicyVersion: number;

  @Column({ type: 'jsonb', default: {} })
  certificateDataSnapshot: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  pdfArtifactReference?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
