import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @ApiOperation({ summary: 'List patients with pagination and search' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get()
  async findAll(@Query() query: PaginationQueryDto & { isArchived?: boolean }) {
    return this.patientsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get patient by ID' })
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
    return this.patientsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new patient' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REPORT_OPERATOR)
  @Post()
  async create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @ApiOperation({ summary: 'Update patient' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REPORT_OPERATOR)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive patient' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async archive(@Param('id') id: string) {
    return this.patientsService.archive(id);
  }

  @ApiOperation({ summary: 'Unarchive/restore patient' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return this.patientsService.unarchive(id);
  }
}
