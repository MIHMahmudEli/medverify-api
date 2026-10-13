import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationSettings])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
