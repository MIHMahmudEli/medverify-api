import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API Root & Service Overview' })
  getRoot() {
    return {
      name: 'MedVerify API',
      description: 'Medical Test Report Generation & Cryptographic QR Verification Platform',
      status: 'operational',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      links: {
        documentation: '/api/docs',
        healthCheck: '/health',
        apiBase: '/api/v1',
      },
    };
  }
}
