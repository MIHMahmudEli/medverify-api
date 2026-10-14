import { AppDataSource } from './src/config/typeorm.config';
import { PdfService } from './src/modules/pdf/pdf.service';
import { VerificationService } from './src/modules/verification/verification.service';
import { MedicalCertificate, MedicalReport, Patient, OrganizationSettings, ReportVerificationToken } from './src/database/entities';
import * as fs from 'fs';
import * as path from 'path';

async function testPdfGeneration() {
  await AppDataSource.initialize();
  console.log('AppDataSource initialized.');

  const certRepo = AppDataSource.getRepository(MedicalCertificate);
  const reportRepo = AppDataSource.getRepository(MedicalReport);
  const patientRepo = AppDataSource.getRepository(Patient);
  const settingsRepo = AppDataSource.getRepository(OrganizationSettings);
  const tokenRepo = AppDataSource.getRepository(ReportVerificationToken);

  const verificationService = new VerificationService(
    tokenRepo,
    reportRepo,
    certRepo,
    { get: (k: string) => k === 'qrVerificationBaseUrl' ? 'https://medverify-zeta.vercel.app/verify' : null } as any,
    { getSettings: async () => settingsRepo.findOne({ where: {} }) } as any,
    null as any
  );

  const pdfService = new PdfService(verificationService);

  const settings = await settingsRepo.findOne({ where: {} });
  const certs = await certRepo.find({
    relations: ['report', 'patient'],
    order: { certificateNumber: 'ASC' }
  });

  const outDir = 'D:/medverify/test_generated_pdfs';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const cert of certs) {
    const report = cert.report;
    const patient = cert.patient;
    console.log(`Generating combined PDF for ${patient.fullName} (${report.registrationNumber})...`);

    const pdfBuffer = await pdfService.generateCombinedPdf(cert, report, patient, settings || undefined);
    const outPath = path.join(outDir, `${report.registrationNumber}_${patient.fullName.replace(/\s+/g, '_')}.pdf`);
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`   Saved: ${outPath} (${pdfBuffer.length} bytes)`);
  }

  console.log('All 5 test PDFs generated successfully.');
  await AppDataSource.destroy();
}

testPdfGeneration().catch(console.error);
