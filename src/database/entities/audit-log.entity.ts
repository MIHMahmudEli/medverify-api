import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  entityId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress?: string;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
