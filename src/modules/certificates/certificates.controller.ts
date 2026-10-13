import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';

@ApiTags('Medical Certificates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @ApiOperation({ summary: 'Issue official medical fitness certificate for report' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DOCTOR)
  @Post('reports/:id/certificate')
  async issueCertificate(
    @Param('id') reportId: string,
    @CurrentUser() user: User,
  ) {
    return this.certificatesService.issueCertificate(reportId, user);
  }

  @ApiOperation({ summary: 'Get active certificate for medical report' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('reports/:id/certificate')
  async getCertificateByReportId(@Param('id') reportId: string) {
    return this.certificatesService.getCertificateByReportId(reportId);
  }

  @ApiOperation({ summary: 'Get certificate details by certificate ID' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('certificates/:id')
  async getCertificateById(@Param('id') id: string) {
    return this.certificatesService.getCertificateById(id);
  }

  @ApiOperation({ summary: 'Revoke official certificate (Admin only)' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('certificates/:id/revoke')
  async revokeCertificate(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: User,
  ) {
    return this.certificatesService.revokeCertificate(id, reason || 'Certificate invalidated by clinic', user);
  }

  @ApiOperation({ summary: 'Download official certificate PDF (Page 1 only)' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('certificates/:id/pdf')
  async getCertificatePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificatesService.getCertificatePdfBuffer(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.end(buffer);
  }

  @ApiOperation({ summary: 'Download or print combined 2-Page Certificate and Report PDF by Certificate ID' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('certificates/:id/print-pdf')
  async getCombinedPdfByCert(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificatesService.getCombinedPdfBuffer(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.end(buffer);
  }

  @ApiOperation({ summary: 'Download or print combined 2-Page Certificate and Report PDF by Report ID' })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.REPORT_OPERATOR,
    UserRole.VIEWER,
  )
  @Get('reports/:id/print-pdf')
  async getCombinedPdfByReport(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificatesService.getCombinedPdfBuffer(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.end(buffer);
  }
}
