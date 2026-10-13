import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { ReportTemplateVersion } from './report-template-version.entity';
import { MedicalReportRevision } from './medical-report-revision.entity';
import { ReportVerificationToken } from './report-verification-token.entity';

export enum ReportStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  FINALIZED = 'FINALIZED',
  AMENDED = 'AMENDED',
  REVOKED = 'REVOKED',
}

export enum MedicalFitnessStatus {
  FIT = 'FIT',
  UNFIT = 'UNFIT',
  PENDING_INVESTIGATION = 'PENDING_INVESTIGATION',
  NOT_EVALUATED = 'NOT_EVALUATED',
}

@Entity('medical_reports')
export class MedicalReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  registrationNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.reports, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  templateVersionId: string;

  @ManyToOne(() => ReportTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'templateVersionId' })
  templateVersion: ReportTemplateVersion;

  @Index()
  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  status: ReportStatus;

  @Column({ type: 'date' })
  registeredAt: string;

  @Column({ type: 'jsonb', default: {} })
  reportData: Record<string, any>;

  @Index()
  @Column({
    type: 'enum',
    enum: MedicalFitnessStatus,
    default: MedicalFitnessStatus.NOT_EVALUATED,
  })
  finalMedicalStatus: MedicalFitnessStatus;

  @Column({ type: 'text', nullable: true })
  finalRemarks?: string;

  @Column({ type: 'uuid', nullable: true })
  finalizedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'finalizedById' })
  finalizedBy?: User;

  @Column({ type: 'timestamp with time zone', nullable: true })
  finalizedAt?: Date;

  @Column({ type: 'integer', default: 1 })
  currentRevisionNumber: number;

  @Column({ type: 'text', nullable: true })
  xrayImageUrl?: string;

  @Column({ type: 'varchar', length: 255, default: 'NORMAL' })
  xrayFinding: string;

  @Column({ type: 'varchar', length: 255, default: 'NORMAL' })
  xrayRemarks: string;

  @Column({ type: 'text', nullable: true })
  fingerprintUrl?: string;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true })
  updatedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy?: User;

  @OneToMany(() => MedicalReportRevision, (rev) => rev.report)
  revisions: MedicalReportRevision[];

  @OneToMany(() => ReportVerificationToken, (tok) => tok.report)
  verificationTokens: ReportVerificationToken[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
