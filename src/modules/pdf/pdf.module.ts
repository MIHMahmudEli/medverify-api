import { Module, forwardRef } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [forwardRef(() => VerificationModule)],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
