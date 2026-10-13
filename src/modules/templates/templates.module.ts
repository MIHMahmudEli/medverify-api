import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { ReportTemplate } from '../../database/entities/report-template.entity';
import { ReportTemplateVersion } from '../../database/entities/report-template-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReportTemplate, ReportTemplateVersion])],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class ReportTemplatesModule {}
