import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ReportTemplate } from './report-template.entity';

export interface TemplateFieldOption {
  label: string;
  value: string;
}

export interface TemplateFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'date' | 'bino_vision' | 'blood_pressure';
  required?: boolean;
  defaultValue?: any;
  options?: TemplateFieldOption[];
  unit?: string;
  placeholder?: string;
  columnSpan?: number; // 1 or 2
  order: number;
}

export interface TemplateSectionDefinition {
  id: string;
  key: string;
  title: string;
  category: 'medical_examination' | 'laboratory_investigation' | 'systemic' | 'xray' | 'general';
  order: number;
  column: 'left' | 'right' | 'full';
  fields: TemplateFieldDefinition[];
}

export interface TemplateSchema {
  title: string;
  sections: TemplateSectionDefinition[];
}

@Entity('report_template_versions')
export class ReportTemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  templateId: string;

  @ManyToOne(() => ReportTemplate, (template) => template.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: ReportTemplate;

  @Column({ type: 'integer' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  schema: TemplateSchema;

  @Column({ type: 'uuid', nullable: true })
  createdById?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
