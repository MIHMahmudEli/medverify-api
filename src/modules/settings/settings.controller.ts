import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: 'Get organization settings' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
  )
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @ApiOperation({ summary: 'Update organization settings (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch()
  async updateSettings(@Body() body: any) {
    return this.settingsService.updateSettings(body);
  }
}
