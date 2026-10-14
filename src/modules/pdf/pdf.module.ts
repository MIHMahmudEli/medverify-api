import { Module, forwardRef } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { VerificationModule } from '../verification/verification.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    forwardRef(() => VerificationModule),
    forwardRef(() => SettingsModule),
  ],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
