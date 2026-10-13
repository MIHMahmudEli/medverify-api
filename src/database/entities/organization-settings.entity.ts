import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organization_settings')
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'MYSA Medical Center' })
  orgName: string;

  @Column({ type: 'varchar', length: 50, default: 'MMS' })
  orgCode: string;

  @Column({ type: 'text', default: 'Diagnostic & Medical Checkup Centre' })
  orgAddress: string;

  @Column({ type: 'varchar', length: 100, default: '+880 1700-000000' })
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

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
