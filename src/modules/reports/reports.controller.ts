import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  UpdateReportDto,
  FinalizeReportDto,
  AmendReportDto,
  RevokeReportDto,
} from './dto/report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';
import {
  ReportStatus,
  MedicalFitnessStatus,
} from '../../database/entities/medical-report.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Medical Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'List medical reports with pagination and filtering' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get()
  async findAll(
    @Query()
    query: PaginationQueryDto & {
      status?: ReportStatus;
      finalMedicalStatus?: MedicalFitnessStatus;
      patientId?: string;
    },
  ) {
    return this.reportsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get medical report by ID' })
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
    return this.reportsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new medical report draft' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REPORT_OPERATOR)
  @Post()
  async create(@Body() dto: CreateReportDto, @CurrentUser() user: User) {
    return this.reportsService.create(dto, user);
  }

  @ApiOperation({ summary: 'Update medical report draft' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
  )
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Submit draft report for doctor review' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.REPORT_OPERATOR)
  @Post(':id/submit')
  async submitForReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.reportsService.submitForReview(id, user);
  }

  @ApiOperation({ summary: 'Finalize and approve report (Doctor / Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DOCTOR)
  @Post(':id/finalize')
  async finalize(
    @Param('id') id: string,
    @Body() dto: FinalizeReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.finalize(id, dto, user);
  }

  @ApiOperation({ summary: 'Amend previously finalized report (Doctor / Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DOCTOR)
  @Post(':id/amend')
  async amend(
    @Param('id') id: string,
    @Body() dto: AmendReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.amend(id, dto, user);
  }

  @ApiOperation({ summary: 'Revoke report (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @Body() dto: RevokeReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.revoke(id, dto, user);
  }

  @ApiOperation({ summary: 'Download or preview server-generated clinical PDF' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.reportsService.getPdfBuffer(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.end(buffer);
  }
}
