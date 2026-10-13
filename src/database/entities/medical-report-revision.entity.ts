import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalReport } from './medical-report.entity';
import { User } from './user.entity';

@Entity('medical_report_revisions')
export class MedicalReportRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => MedicalReport, (report) => report.revisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: MedicalReport;

  @Column({ type: 'integer' })
  revisionNumber: number;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'varchar', length: 50 })
  finalMedicalStatus: string;

  @Column({ type: 'jsonb' })
  reportDataSnapshot: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  patientDataSnapshot?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  reasonForChange?: string;

  @Column({ type: 'uuid', nullable: true })
  changedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changedById' })
  changedBy?: User;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
