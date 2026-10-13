import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  CreateTemplateVersionDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';

@ApiTags('Report Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @ApiOperation({ summary: 'Get all report templates' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
  )
  @Get()
  async findAll() {
    return this.templatesService.findAll();
  }

  @ApiOperation({ summary: 'Get currently active report template and version' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
  )
  @Get('active')
  async getActive() {
    return this.templatesService.getActiveTemplate();
  }

  @ApiOperation({ summary: 'Get report template by ID with all versions' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
  )
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new report template' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: User) {
    return this.templatesService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Create new version for report template' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/versions')
  async createVersion(
    @Param('id') id: string,
    @Body() dto: CreateTemplateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.templatesService.createVersion(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Activate specific version for template' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/activate-version/:versionId')
  async activateVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.templatesService.activateVersion(id, versionId);
  }

  @ApiOperation({ summary: 'Update report template metadata' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }
}
