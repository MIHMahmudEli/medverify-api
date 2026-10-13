import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MedicalReport } from './medical-report.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  passportNumber: string;

  @Column({ type: 'date' })
  dateOfBirth: string;

  @Column({ type: 'varchar', length: 30 })
  gender: string;

  @Column({ type: 'varchar', length: 100 })
  nationality: string;

  @Column({ type: 'varchar', length: 100 })
  country: string;

  @Column({ type: 'varchar', length: 50, default: 'Single' })
  maritalStatus: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  religion?: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  heightCm?: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  weightKg?: number;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  agency?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'text', nullable: true })
  fingerprintUrl?: string;

  @Column({ type: 'text', nullable: true })
  photoUrl?: string;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @OneToMany(() => MedicalReport, (report) => report.patient)
  reports: MedicalReport[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
