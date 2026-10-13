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

@Entity('report_verification_tokens')
export class ReportVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => MedicalReport, (report) => report.verificationTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: MedicalReport;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  token: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  tokenHash?: string;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  revokedById?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revokedById' })
  revokedBy?: User;

  @Column({ type: 'text', nullable: true })
  revocationReason?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
