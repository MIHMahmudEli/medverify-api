import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerificationService } from './verification.service';

@ApiTags('Public Verification')
@Controller('public/verify')
export class PublicVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @ApiOperation({
    summary: 'Public verification endpoint for QR code scans',
    description: 'Returns structured public verification data without unrestricted private records',
  })
  @ApiResponse({ status: 200, description: 'Verification check completed' })
  @HttpCode(HttpStatus.OK)
  @Get(':token')
  async verify(@Param('token') token: string) {
    return this.verificationService.verifyPublicToken(token);
  }

  @ApiOperation({
    summary: 'Download combined 2-Page Certificate and Report PDF via verification token',
  })
  @Get(':token/print-pdf')
  async downloadCombinedPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.verificationService.getPublicCombinedPdfBuffer(token);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    res.end(buffer);
  }

  @ApiOperation({
    summary: 'Download combined 2-Page Certificate and Report PDF (alias)',
  })
  @Get(':token/pdf')
  async downloadPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    return this.downloadCombinedPdf(token, res);
  }
}
