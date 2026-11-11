import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({ summary: 'Get all clinical organizations' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get()
  async findAll() {
    return this.organizationsService.findAll();
  }

  @ApiOperation({ summary: 'Get default primary organization' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('default')
  async getDefault() {
    return this.organizationsService.getDefault();
  }

  @ApiOperation({ summary: 'Get organization details by ID' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new clinical organization (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @ApiOperation({ summary: 'Update clinical organization (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Set organization as default (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/set-default')
  async setDefault(@Param('id') id: string) {
    return this.organizationsService.setDefault(id);
  }

  @ApiOperation({ summary: 'Delete organization (Super Admin only)' })
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.organizationsService.delete(id);
  }
}
