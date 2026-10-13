import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerificationService } from './verification.service';

@ApiTags('Public Verification')
@Controller('public/verify')
export class PublicVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @ApiOperation({
    summary: 'Public verification endpoint for QR code scans',
    description: 'Returns minimal public verification data without sensitive medical records',
  })
  @ApiResponse({ status: 200, description: 'Verification check completed' })
  @HttpCode(HttpStatus.OK)
  @Get(':token')
  async verify(@Param('token') token: string) {
    return this.verificationService.verifyPublicToken(token);
  }
}
