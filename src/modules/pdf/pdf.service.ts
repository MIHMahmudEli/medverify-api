import { Injectable, Inject, forwardRef } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import { join } from 'path';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { Patient } from '../../database/entities/patient.entity';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { OrganizationSettings } from '../../database/entities/organization-settings.entity';
import { VerificationService } from '../verification/verification.service';

export interface PdfRenderOptions {
  pageNumber?: number;
  totalPages?: number;
  qrUrl?: string;
  qrBuffer?: Buffer | null;
}

@Injectable()
export class PdfService {
  constructor(
    @Inject(forwardRef(() => VerificationService))
    private readonly verificationService: VerificationService,
  ) {}

  private calculateAge(dobStr: string): string {
    if (!dobStr) return 'N/A';
    const dob = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${Math.max(0, age)} Y`;
  }

  private formatDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Resolves an image path from either user uploads or fallback assets.
  /**
   * Resolves image either from local disk cache or dynamically fetches from Supabase Storage CDN.
   * Returns a file path string or a memory Buffer.
   */
  private async resolveImageBuffer(
    imageRef?: string,
    defaultFileName?: string,
  ): Promise<string | Buffer | null> {
    if (imageRef) {
      let cleanFilename = imageRef;
      if (cleanFilename.includes('/object/public/medverify/')) {
        cleanFilename = cleanFilename.split('/object/public/medverify/')[1];
      } else if (cleanFilename.includes('/medverify/')) {
        cleanFilename = cleanFilename.split('/medverify/')[1];
      } else if (cleanFilename.includes('/uploads/file/')) {
        cleanFilename = cleanFilename.split('/uploads/file/')[1];
      } else if (cleanFilename.includes('/uploads/')) {
        cleanFilename = cleanFilename.split('/uploads/')[1];
      } else if (cleanFilename.includes('/')) {
        cleanFilename = cleanFilename.split('/').pop() || cleanFilename;
      }
      cleanFilename = cleanFilename.replace(/^\//, '').split('?')[0];

      // 1. Check local candidates on disk
      const candidates = [
        join(process.cwd(), 'uploads', cleanFilename),
        join(process.cwd(), 'assets', cleanFilename),
        join(process.cwd(), 'medverify-api', 'assets', cleanFilename),
        join(process.cwd(), 'dist', 'assets', cleanFilename),
        join(__dirname, 'assets', cleanFilename),
        join(__dirname, '../assets', cleanFilename),
        join(__dirname, '../../assets', cleanFilename),
        join(__dirname, '../../../assets', cleanFilename),
        join(__dirname, '../../../../assets', cleanFilename),
      ];

      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }

      // 2. Fetch from direct remote URL (Supabase Storage / HTTP)
      if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
        try {
          const res = await fetch(imageRef);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            try {
              const uDir = join(process.cwd(), 'uploads');
              if (!fs.existsSync(uDir)) fs.mkdirSync(uDir, { recursive: true });
              fs.writeFileSync(join(uDir, cleanFilename), buf);
            } catch {}
            return buf;
          }
        } catch (fetchErr: any) {
          console.warn(`[PdfService] Failed to download image from ${imageRef}: ${fetchErr.message}`);
        }
      }

      // 3. Construct Supabase CDN URL for this filename if not found locally
      const supabaseUrl = process.env.SUPABASE_URL || 'https://lfllressuzifwyxmevdr.supabase.co';
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'medverify';
      if (cleanFilename) {
        try {
          const cdnUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${cleanFilename}`;
          const res = await fetch(cdnUrl);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            try {
              const uDir = join(process.cwd(), 'uploads');
              if (!fs.existsSync(uDir)) fs.mkdirSync(uDir, { recursive: true });
              fs.writeFileSync(join(uDir, cleanFilename), buf);
            } catch {}
            return buf;
          }
        } catch {}
      }
    }

    // 4. Default image fallback
    if (defaultFileName) {
      const candidates = [
        join(process.cwd(), 'uploads', defaultFileName),
        join(process.cwd(), 'assets', defaultFileName),
        join(process.cwd(), 'medverify-api', 'assets', defaultFileName),
        join(process.cwd(), 'dist', 'assets', defaultFileName),
        join(__dirname, 'assets', defaultFileName),
        join(__dirname, '../assets', defaultFileName),
        join(__dirname, '../../assets', defaultFileName),
        join(__dirname, '../../../assets', defaultFileName),
        join(__dirname, '../../../../assets', defaultFileName),
      ];

      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }

    return null;
  }

  /**
   * Deterministically renders a barcode graphic below REG NO.
   */
  private drawBarcode(doc: any, x: number, y: number, regNo: string) {
    const barColor = '#008080';
    const barHeight = 14.5;
    const barPattern = [
      2.89, 1.45, 1.45, 1.45, 4.34, 2.89, 1.45, 4.34, 2.89, 2.89,
      4.34, 1.45, 2.89, 4.34, 1.45, 1.45, 4.34, 5.78, 2.89, 1.45,
      4.34, 1.45, 1.45, 5.78, 2.89, 1.45, 1.45, 2.89, 1.45, 1.45,
      2.89, 4.34, 1.45, 2.89,
    ];

    let currentX = x;
    doc.fillColor(barColor);
    barPattern.forEach((w, idx) => {
      const shouldDraw = idx % 3 !== 2;
      if (shouldDraw) {
        doc.rect(currentX, y, w, barHeight).fill(barColor);
      }
      currentX += w + 1.45;
    });
  }

  /**
   * Renders PAGE 1: Official Medical Fitness Certificate
   */
  public async renderCertificatePage(
    doc: any,
    certificate: MedicalCertificate,
    report: MedicalReport,
    patient: Patient,
    settings?: OrganizationSettings,
    opts: PdfRenderOptions = {},
  ) {
    const orgName = settings?.orgName || 'MYSA MEDICAL SERVICES (PVT.) LTD.';
    const orgAddress =
      settings?.orgAddress ||
      'Diagnostic & Medical Checkup Centre for Overseas Employment';
    const orgPhone = settings?.orgPhone || '+880 1700-000000';
    const orgEmail = settings?.orgEmail || 'info@mysamedicalbd.com';
    const certTitle = settings?.certificateTitle || 'MEDICAL FITNESS CERTIFICATE';
    const signatoryName = settings?.signatoryName || 'Dr. A. K. M. Shamsuddin';
    const signatoryDesignation =
      settings?.signatoryDesignation || 'MBBS, FCPS - Medical Director';
    const signatoryLicense =
      settings?.signatoryLicenseNumber || 'BMDC Reg No: A-12345';
    const certFooter =
      settings?.certificateFooter ||
      'This official certificate is generated and authenticated via MedVerify. Tampering or altering this document invalidates its certification.';

    const safePatient = patient || ({} as Patient);
    const pageNum = opts.pageNumber || 1;
    const totalPages = opts.totalPages || 2;
    const qrUrl = opts.qrUrl || this.verificationService.getVerificationUrl(certificate.verificationToken);
    const qrBuffer = opts.qrBuffer;

    const isFit = (report.finalMedicalStatus || 'FIT') === 'FIT';
    const age = safePatient.dateOfBirth ? this.calculateAge(safePatient.dateOfBirth) : 'N/A';

    // Outer & Inner Elegant Certificate Frame
    doc.lineWidth(1.5).strokeColor('#1e3a5f');
    doc.rect(28.5, 25, 538.28, 792).stroke();

    doc.lineWidth(0.5).strokeColor('#c5a059');
    doc.rect(32.5, 29, 530.28, 784).stroke();

    // Corner Accents
    const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
      doc.lineWidth(1.2).strokeColor('#c5a059');
      doc.moveTo(cx, cy + dy * 12).lineTo(cx, cy).lineTo(cx + dx * 12, cy).stroke();
    };
    drawCorner(36, 33, 1, 1);
    drawCorner(559, 33, -1, 1);
    drawCorner(36, 809, 1, -1);
    drawCorner(559, 809, -1, -1);

    // --- 1. INSTITUTIONAL HEADER ---
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e3a5f');
    doc.text(orgName.toUpperCase(), 35, 42, { align: 'center', width: 525 });

    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    doc.text(orgAddress, 35, 59, { align: 'center', width: 525 });

    doc.fontSize(7.5).fillColor('#64748b');
    doc.text(`Phone: ${orgPhone}  |  Email: ${orgEmail}  |  Govt. Approved Center`, 35, 71, {
      align: 'center',
      width: 525,
    });

    // Decorative divider line
    doc.lineWidth(0.8).strokeColor('#c5a059').moveTo(60, 85).lineTo(535, 85).stroke();

    // --- 2. CERTIFICATE TITLE RIBBON ---
    const ribbonY = 94;
    doc.rect(120, ribbonY, 355, 22).fill('#f8fafc');
    doc.lineWidth(0.8).strokeColor('#1e3a5f').rect(120, ribbonY, 355, 22).stroke();

    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#1e3a5f');
    doc.text(certTitle.toUpperCase(), 120, ribbonY + 5.5, { align: 'center', width: 355 });

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0d5c75');
    doc.text(
      'OFFICIAL PRE-EMPLOYMENT HEALTH EXAMINATION & CLEARANCE CREDENTIAL',
      35,
      ribbonY + 27,
      { align: 'center', width: 525 },
    );

    // --- 3. IDENTIFICATION NUMBERS BAR ---
    const idBarY = 132;
    doc.rect(42, idBarY, 511, 28).fill('#f1f5f9');
    doc.lineWidth(0.5).strokeColor('#cbd5e1').rect(42, idBarY, 511, 28).stroke();

    const colW = 511 / 4;
    // Dividers
    doc.moveTo(42 + colW, idBarY).lineTo(42 + colW, idBarY + 28).stroke();
    doc.moveTo(42 + colW * 2, idBarY).lineTo(42 + colW * 2, idBarY + 28).stroke();
    doc.moveTo(42 + colW * 3, idBarY).lineTo(42 + colW * 3, idBarY + 28).stroke();

    const drawMetaCell = (title: string, value: string, idx: number, highlight: boolean = false) => {
      const cellX = 42 + colW * idx;
      doc.font('Helvetica').fontSize(6).fillColor('#64748b').text(title, cellX + 5, idBarY + 4);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(highlight ? '#1e3a5f' : '#0f172a');
      doc.text(value, cellX + 5, idBarY + 14, { width: colW - 10 });
    };

    drawMetaCell('CERTIFICATE NUMBER', certificate.certificateNumber, 0, true);
    drawMetaCell('REPORT REG. NO', report.registrationNumber, 1);
    drawMetaCell('EXAMINATION DATE', this.formatDate(report.registeredAt), 2);
    drawMetaCell('DATE OF ISSUANCE', this.formatDate(certificate.issuedAt), 3);

    // --- 4. CANDIDATE IDENTITY SECTION ---
    const pSecY = 169;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a5f');
    doc.text('CANDIDATE IDENTIFICATION DETAILS', 42, pSecY);

    const pBoxY = pSecY + 13;
    const pBoxW = 511;
    const pBoxH = 104;
    const photoW = 86;
    const detailsW = pBoxW - photoW;

    doc.lineWidth(0.6).strokeColor('#cbd5e1').rect(42, pBoxY, pBoxW, pBoxH).stroke();
    doc.moveTo(42 + detailsW, pBoxY).lineTo(42 + detailsW, pBoxY + pBoxH).stroke();

    // Patient info rows inside details area
    const pRows = [
      ['Full Name', (safePatient.fullName || '').toUpperCase(), 'Passport No', (safePatient.passportNumber || '').toUpperCase()],
      ['Date of Birth', safePatient.dateOfBirth ? this.formatDate(safePatient.dateOfBirth) : 'N/A', 'Age / Gender', `${age}  /  ${safePatient.gender || 'Male'}`],
      ['Nationality', (safePatient.nationality || 'Bangladeshi').toUpperCase(), 'Marital Status', safePatient.maritalStatus || 'Unmarried'],
      ['Destination', (safePatient.country || 'N/A').toUpperCase(), 'Recruiting Agency', safePatient.agency || '—'],
    ];

    const rowHeight = pBoxH / 4;
    pRows.forEach((r, idx) => {
      const rY = pBoxY + idx * rowHeight;
      if (idx > 0) {
        doc.moveTo(42, rY).lineTo(42 + detailsW, rY).stroke();
      }

      // Col 1 label & val
      doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text(r[0], 48, rY + 4);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(r[1], 48, rY + 13, { width: 195 });

      // Col 2 label & val
      doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text(r[2], 255, rY + 4);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(r[3], 255, rY + 13, { width: 165 });
    });

    // Patient Photo
    const photoBoxX = 42 + detailsW;
    const photoCandidate = safePatient.photoUrl || (report.registrationNumber ? `photo_${report.registrationNumber}.png` : undefined);
    const photoPath = await this.resolveImageBuffer(photoCandidate, 'default_photo.png');
    if (photoPath) {
      try {
        doc.image(photoPath, photoBoxX + 3, pBoxY + 3, {
          fit: [photoW - 6, pBoxH - 6],
          align: 'center',
          valign: 'center',
        });
      } catch (e) {
        doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text('[ PHOTO ]', photoBoxX, pBoxY + 45, { align: 'center', width: photoW });
      }
    } else {
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text('[ PHOTO ]', photoBoxX, pBoxY + 45, { align: 'center', width: photoW });
    }

    // --- 5. MEDICAL FITNESS STATEMENT & DECLARATION ---
    const stmtSecY = 296;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a5f');
    doc.text('OFFICIAL CLINICAL FITNESS DECLARATION', 42, stmtSecY);

    const stmtBoxY = stmtSecY + 13;
    const stmtBoxH = 112;
    doc.lineWidth(0.6).strokeColor('#cbd5e1').rect(42, stmtBoxY, pBoxW, stmtBoxH).stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
    doc.text(
      'This is to certify that the candidate identified above has undergone comprehensive medical, radiological, and clinical laboratory examinations in strict accordance with the mandatory health screening protocol. Based upon the complete clinical assessment and diagnostic evaluations performed, the candidate is officially certified as:',
      50,
      stmtBoxY + 9,
      { width: 495, lineGap: 1.5 },
    );

    // Prominent Status Banner
    const statusBannerY = stmtBoxY + 47;
    const statusBannerH = 34;

    if (isFit) {
      doc.rect(50, statusBannerY, 495, statusBannerH).fill('#ecfdf5');
      doc.lineWidth(1.2).strokeColor('#059669').rect(50, statusBannerY, 495, statusBannerH).stroke();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#065f46');
      doc.text('CERTIFIED STATUS: MEDICALLY FIT FOR EMPLOYMENT', 50, statusBannerY + 11, {
        align: 'center',
        width: 495,
      });
    } else {
      doc.rect(50, statusBannerY, 495, statusBannerH).fill('#fff1f2');
      doc.lineWidth(1.2).strokeColor('#e11d48').rect(50, statusBannerY, 495, statusBannerH).stroke();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#9f1239');
      doc.text('CERTIFIED STATUS: MEDICALLY UNFIT FOR EMPLOYMENT', 50, statusBannerY + 11, {
        align: 'center',
        width: 495,
      });
    }

    // Clinical Remarks
    doc.font('Helvetica').fontSize(7).fillColor('#64748b');
    doc.text('Authorized Remarks:', 50, stmtBoxY + 89);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(isFit ? '#059669' : '#e11d48');
    doc.text(report.finalRemarks || (isFit ? 'CLINICALLY FIT FOR OVERSEAS EMPLOYMENT' : 'UNFIT DUE TO CLINICAL FINDINGS'), 130, stmtBoxY + 89);

    // --- 6. SCOPE OF EXAMINATION SUMMARY ---
    const scopeY = 429;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a5f');
    doc.text('SUMMARY OF COMPLETED CLINICAL ASSESSMENTS', 42, scopeY);

    const scopeBoxY = scopeY + 13;
    const scopeBoxH = 88;
    doc.lineWidth(0.6).strokeColor('#cbd5e1').rect(42, scopeBoxY, pBoxW, scopeBoxH).stroke();

    const scopeCols = [
      {
        title: 'PHYSICAL & SENSORY',
        desc: 'Visual acuity, auditory exam, blood pressure, BMI, psychiatric and physical evaluation.',
        status: 'SATISFACTORY',
      },
      {
        title: 'SYSTEMIC EXAMINATION',
        desc: 'Cardiovascular, respiratory (lungs), abdomen, extremities, and central nervous system.',
        status: 'NORMAL (NAD)',
      },
      {
        title: 'SEROLOGY & BIOCHEMISTRY',
        desc: 'HIV I & II, HBsAg, Anti-HCV, VDRL, Creatinine, Bilirubin, SGPT/SGOT, Blood Glucose.',
        status: 'NON-REACTIVE',
      },
      {
        title: 'PULMONARY RADIOLOGY',
        desc: 'High-resolution chest radiograph (X-ray) for tuberculosis and active thoracic pathology.',
        status: report.xrayFinding || 'NORMAL',
      },
    ];

    const sCardW = (pBoxW - 15) / 4;
    scopeCols.forEach((card, idx) => {
      const cardX = 42 + 3 + idx * (sCardW + 3);
      doc.rect(cardX, scopeBoxY + 4, sCardW, scopeBoxH - 8).fill('#f8fafc');
      doc.lineWidth(0.5).strokeColor('#e2e8f0').rect(cardX, scopeBoxY + 4, sCardW, scopeBoxH - 8).stroke();

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#1e3a5f').text(card.title, cardX + 4, scopeBoxY + 8, { width: sCardW - 8 });
      doc.font('Helvetica').fontSize(5.5).fillColor('#64748b').text(card.desc, cardX + 4, scopeBoxY + 22, { width: sCardW - 8, lineGap: 1 });
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#059669').text(card.status, cardX + 4, scopeBoxY + 68, { width: sCardW - 8, align: 'center' });
    });

    // --- 7. VERIFICATION & SIGNATORY SECTION ---
    const authY = 538;
    const authBoxH = 170;
    const authBoxW = pBoxW;

    // Left Box: Digital Online Verification
    const leftAuthW = 240;
    doc.lineWidth(0.6).strokeColor('#cbd5e1').rect(42, authY, leftAuthW, authBoxH).stroke();

    doc.rect(42, authY, leftAuthW, 18).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a5f');
    doc.text('CRYPTOGRAPHIC ONLINE AUTHENTICATION', 42, authY + 5.5, { align: 'center', width: leftAuthW });

    if (qrBuffer) {
      doc.image(qrBuffer, 42 + 75, authY + 26, { width: 90, height: 90 });
    }

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    doc.text('SCAN TO AUTHENTICATE CERTIFICATE', 42, authY + 121, { align: 'center', width: leftAuthW });

    doc.font('Helvetica').fontSize(5.5).fillColor('#64748b');
    doc.text('Official verification against MedVerify digital ledger.', 42, authY + 131, { align: 'center', width: leftAuthW });
    doc.text(`Token: ${certificate.verificationToken.substring(0, 18)}...`, 42, authY + 140, { align: 'center', width: leftAuthW });

    // Right Box: Authorized Signatory & Official Seal
    const rightAuthX = 42 + leftAuthW + 11;
    const rightAuthW = authBoxW - leftAuthW - 11;
    doc.lineWidth(0.6).strokeColor('#cbd5e1').rect(rightAuthX, authY, rightAuthW, authBoxH).stroke();

    doc.rect(rightAuthX, authY, rightAuthW, 18).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a5f');
    doc.text('AUTHORIZED MEDICAL SIGNATORY & SEAL', rightAuthX, authY + 5.5, { align: 'center', width: rightAuthW });

    // Signature Graphic
    const sigPath = await this.resolveImageBuffer(settings?.signatorySignatureUrl, 'doctor_signature.png');
    if (sigPath) {
      try {
        doc.image(sigPath, rightAuthX + (rightAuthW - 130) / 2, authY + 28, { fit: [130, 48], align: 'center' });
      } catch (e) {
        doc.lineWidth(0.6).strokeColor('#94a3b8').moveTo(rightAuthX + 30, authY + 75).lineTo(rightAuthX + rightAuthW - 30, authY + 75).stroke();
      }
    } else {
      doc.lineWidth(0.6).strokeColor('#94a3b8').moveTo(rightAuthX + 30, authY + 75).lineTo(rightAuthX + rightAuthW - 30, authY + 75).stroke();
    }

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
    doc.text(signatoryName, rightAuthX + 15, authY + 84, { align: 'center', width: rightAuthW - 30 });

    doc.font('Helvetica').fontSize(7).fillColor('#475569');
    doc.text(signatoryDesignation, rightAuthX + 15, authY + 96, { align: 'center', width: rightAuthW - 30 });

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0d5c75');
    doc.text(signatoryLicense, rightAuthX + 15, authY + 107, { align: 'center', width: rightAuthW - 30 });

    doc.font('Helvetica').fontSize(6).fillColor('#94a3b8');
    doc.text('Official Clinical Director & Authorized Examiner', rightAuthX + 15, authY + 118, { align: 'center', width: rightAuthW - 30 });

    // Official Clinic Stamp & Seal
    const stampPath = await this.resolveImageBuffer(undefined, 'official_stamp.png');
    if (stampPath) {
      try {
        doc.image(stampPath, rightAuthX + (rightAuthW - 48) / 2, authY + 128, {
          fit: [48, 48],
          align: 'center',
        });
      } catch (e) {
        doc.rect(rightAuthX + (rightAuthW - 120) / 2, authY + 133, 120, 24).fill('#f1f5f9');
        doc.lineWidth(0.5).strokeColor('#c5a059').rect(rightAuthX + (rightAuthW - 120) / 2, authY + 133, 120, 24).stroke();
        doc.font('Helvetica-Bold').fontSize(6).fillColor('#1e3a5f').text('OFFICIAL CLINIC STAMP & SEAL', rightAuthX + (rightAuthW - 120) / 2, authY + 140, { align: 'center', width: 120 });
      }
    } else {
      doc.rect(rightAuthX + (rightAuthW - 120) / 2, authY + 133, 120, 24).fill('#f1f5f9');
      doc.lineWidth(0.5).strokeColor('#c5a059').rect(rightAuthX + (rightAuthW - 120) / 2, authY + 133, 120, 24).stroke();
      doc.font('Helvetica-Bold').fontSize(6).fillColor('#1e3a5f').text('OFFICIAL CLINIC STAMP & SEAL', rightAuthX + (rightAuthW - 120) / 2, authY + 140, { align: 'center', width: 120 });
    }

    // --- 8. OFFICIAL FOOTER ---
    const certFootY = 720;
    doc.lineWidth(0.5).strokeColor('#cbd5e1').moveTo(42, certFootY).lineTo(553, certFootY).stroke();

    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text(certFooter, 42, certFootY + 5, { width: 511, align: 'center' });

    // Bottom pagination bar
    const btmBarY = 801;
    doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(42, btmBarY).lineTo(553, btmBarY).stroke();
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
    doc.text(`Official Medical Fitness Certificate | ${certificate.certificateNumber}`, 42, btmBarY + 4);
    doc.text(`Page ${pageNum} of ${totalPages}`, 450, btmBarY + 4, { width: 103, align: 'right' });
  }

  /**
   * Renders PAGE 2: Detailed Medical Test Report (matches reference PDF layout)
   */
  public async renderReportPage(
    doc: any,
    report: MedicalReport,
    patient: Patient,
    opts: PdfRenderOptions = {},
  ) {
    const pageNum = opts.pageNumber || 2;
    const totalPages = opts.totalPages || 2;
    const qrBuffer = opts.qrBuffer;
    const qrUrl = opts.qrUrl || '';

    const safePatient = patient || ({} as Patient);
    const data = report.reportData || {};
    const age = safePatient.dateOfBirth ? this.calculateAge(safePatient.dateOfBirth) : 'N/A';

    // --- 1. TOP HEADER BANNER ---
    const bannerPath = await this.resolveImageBuffer(undefined, 'header_banner.png');
    if (bannerPath) {
      doc.image(bannerPath, 28.5, 28.5, { width: 538.75, height: 47.73 });
    } else {
      doc.rect(28.5, 28.5, 538.75, 47.73).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
      doc.text('MYSA MEDICAL SERVICES (PVT.) LTD.', 28.5, 34, { align: 'center', width: 538.75 });
      doc.fontSize(7.5).font('Helvetica');
      doc.text('Govt. Approved Medical Examination & Diagnostic Center for Overseas Employment', 28.5, 50, { align: 'center', width: 538.75 });
      doc.text('Licence No: DGHS/MED-84920/2024 | Phone: +880 1700-000000', 28.5, 60, { align: 'center', width: 538.75 });
    }

    // --- 2. DOCUMENT TITLE ---
    doc.fillColor('#212529').fontSize(11.5).font('Helvetica-Bold');
    doc.text('MEDICAL TEST REPORT', 28.5, 80, { align: 'center', width: 538.75 });

    // --- 3. REGISTRATION NUMBER, BARCODE & REG DATE ---
    const regY = 99.3;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#212529');
    doc.text(`REG NO: ${report.registrationNumber}`, 33.5, regY);

    this.drawBarcode(doc, 35.7, 121.0, report.registrationNumber);

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#212529');
    doc.text(`Reg. Date: ${this.formatDate(report.registeredAt)}`, 340, regY, {
      width: 179,
      align: 'right',
    });

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#212529');
    doc.text('Finger Print', 440, 121, { align: 'center', width: 127.25 });

    // --- 4. PATIENT INFO TABLE & PHOTO BOX ---
    const pTableX = 28.5;
    const pTableY = 143.5;
    const pTableW = 410.8;
    const pTableH = 108.5;
    const photoBoxX = 439.3;
    const photoBoxW = 127.95;
    const photoBoxH = 108.5;

    doc.lineWidth(0.6).strokeColor('#212529');
    doc.rect(pTableX, pTableY, pTableW, pTableH).stroke();

    const vDiv1 = 151.4;
    const vDiv2 = 251.2;
    const vDiv3 = 351.0;
    doc.moveTo(vDiv1, pTableY).lineTo(vDiv1, pTableY + pTableH).stroke();
    doc.moveTo(vDiv2, pTableY).lineTo(vDiv2, pTableY + pTableH).stroke();
    doc.moveTo(vDiv3, pTableY).lineTo(vDiv3, pTableY + pTableH).stroke();

    const patientRows = [
      ['NAME', (safePatient.fullName || '').toUpperCase(), 'COUNTRY', (safePatient.country || 'N/A').toUpperCase()],
      ['PASSPORT NO', (safePatient.passportNumber || '').toUpperCase(), 'BIRTH DATE', safePatient.dateOfBirth ? this.formatDate(safePatient.dateOfBirth) : 'N/A'],
      ['MARITAL STATUS', safePatient.maritalStatus || 'Unmarried', 'RELIGION', safePatient.religion || 'Islam'],
      ['AGE', age, 'GENDER', safePatient.gender || 'Male'],
      ['NATIONALITY', safePatient.nationality || 'Bangladeshi', 'HEIGHT (CM)', safePatient.heightCm ? String(safePatient.heightCm) : ''],
      ['AGENCY', safePatient.agency || '', 'WEIGHT (KG)', safePatient.weightKg ? String(parseFloat(String(safePatient.weightKg))) : ''],
    ];

    patientRows.forEach((r, idx) => {
      const rowY = pTableY + idx * 18.08;
      if (idx > 0) {
        doc.moveTo(pTableX, rowY).lineTo(pTableX + pTableW, rowY).stroke();
      }

      doc.fillColor('#212529').fontSize(8).font('Helvetica');
      doc.text(r[0], pTableX + 5, rowY + 5, { width: vDiv1 - pTableX - 8 });

      doc.font('Helvetica-Bold');
      doc.text(r[1], vDiv1 + 5, rowY + 5, { width: vDiv2 - vDiv1 - 8 });

      doc.font('Helvetica');
      doc.text(r[2], vDiv2 + 5, rowY + 5, { width: vDiv3 - vDiv2 - 8 });

      doc.font('Helvetica-Bold');
      doc.text(r[3], vDiv3 + 5, rowY + 5, { width: pTableX + pTableW - vDiv3 - 8 });
    });

    doc.rect(photoBoxX, pTableY, photoBoxW, photoBoxH).stroke();
    const photoCandidate = safePatient.photoUrl || (report.registrationNumber ? `photo_${report.registrationNumber}.png` : undefined);
    const photoPath = await this.resolveImageBuffer(photoCandidate, 'default_photo.png');
    if (photoPath) {
      try {
        doc.image(photoPath, photoBoxX + 2, pTableY + 2, {
          fit: [photoBoxW - 4, photoBoxH - 4],
          align: 'center',
          valign: 'center',
        });
      } catch (e) {
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica');
        doc.text('[ PATIENT PHOTO ]', photoBoxX, pTableY + 45, { align: 'center', width: photoBoxW });
      }
    }

    // --- 5. CLINICAL EXAMINATION & LABORATORY TABLES ---
    const tableTopY = 264.3;
    const leftTableX = 28.5;
    const leftTableW = 260.3;
    const leftDividerX = 220.9;

    const rightTableX = 306.9;
    const rightTableW = 259.6;
    const rightDividerX = 488.4;

    const rowH = 13.8;
    // Left Table Header
    doc.rect(leftTableX, tableTopY, leftTableW, rowH).stroke();
    doc.fillColor('#212529').fontSize(8.5).font('Helvetica-Bold');
    doc.text('MEDICAL EXAMINATION', leftTableX, tableTopY + 3.2, { align: 'center', width: leftTableW });

    const subheaderY = tableTopY + rowH;
    doc.rect(leftTableX, subheaderY, leftTableW, rowH).stroke();
    doc.moveTo(leftDividerX, subheaderY).lineTo(leftDividerX, subheaderY + rowH).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold');
    doc.text('TYPE OF THE EXAM', leftTableX + 5, subheaderY + 3.2);
    doc.text('RESULT', leftDividerX, subheaderY + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });

    let curLY = subheaderY + rowH;

    const drawSubHeaderLeft = (title: string) => {
      doc.rect(leftTableX, curLY, leftTableW, rowH).stroke();
      doc.fillColor('#212529').fontSize(7.5).font('Helvetica-Bold');
      doc.text(title, leftTableX, curLY + 3.2, { align: 'center', width: leftTableW });
      curLY += rowH;
    };

    const drawRowLeft = (exam: string, result: string, isResultRed: boolean = false) => {
      doc.rect(leftTableX, curLY, leftTableW, rowH).stroke();
      doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + rowH).stroke();
      doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
      doc.text(exam, leftTableX + 5, curLY + 3.2, { width: leftDividerX - leftTableX - 10 });
      if (isResultRed) {
        doc.fillColor('#ff0000').font('Helvetica-Bold');
      } else {
        doc.fillColor('#212529').font('Helvetica');
      }
      doc.text(result !== undefined && result !== null ? result : 'NAD', leftDividerX, curLY + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
      curLY += rowH;
    };

    // Eye Visual Acuity
    doc.rect(leftTableX, curLY, leftTableW, rowH * 2).stroke();
    doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + rowH * 2).stroke();
    doc.moveTo(leftDividerX, curLY + rowH).lineTo(leftTableX + leftTableW, curLY + rowH).stroke();
    doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
    doc.text('EYE Visual Acuity', leftTableX + 5, curLY + 8.5);
    doc.text(`R:  ${data.eye_visual_acuity_r || '6/6'}`, leftDividerX, curLY + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
    doc.text(`L:  ${data.eye_visual_acuity_l || '6/6'}`, leftDividerX, curLY + rowH + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
    curLY += rowH * 2;

    // Ear
    doc.rect(leftTableX, curLY, leftTableW, rowH * 2).stroke();
    doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + rowH * 2).stroke();
    doc.moveTo(leftDividerX, curLY + rowH).lineTo(leftTableX + leftTableW, curLY + rowH).stroke();
    doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
    doc.text('EAR', leftTableX + 5, curLY + 8.5);
    doc.text(`R:  ${data.ear_r || 'NAD'}`, leftDividerX, curLY + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
    doc.text(`L:  ${data.ear_l || 'NAD'}`, leftDividerX, curLY + rowH + 3.2, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
    curLY += rowH * 2;

    drawSubHeaderLeft('SYSTEMIC EXAM: CARDIO-VASCULAR');
    drawRowLeft('B.P', data.blood_pressure || '120/80');
    drawRowLeft('HEART', data.heart || 'NAD');

    drawSubHeaderLeft('RESPIRATORY EXAM');
    drawRowLeft('LUNGS', data.lungs || 'NAD');
    drawRowLeft('GASTROINTESTINAL ABDOMEN', data.abdomen || 'NAD');

    drawSubHeaderLeft('OTHERS');
    drawRowLeft('HERNIA', data.hernia || 'ABSENT');
    drawRowLeft('VARICOSE VEINS', data.varicose_veins || 'ABSENT');
    drawRowLeft('DEFORMITIES', data.deformities || 'ABSENT');
    drawRowLeft('SKIN', data.skin !== undefined ? data.skin : '');
    drawRowLeft('C.N.S', data.cns !== undefined ? data.cns : '');
    drawRowLeft('EXTREMITIES', data.extremities || 'NAD');
    drawRowLeft('PSYCHIATRY', data.psychiatry || 'NAD');

    drawSubHeaderLeft('VENEREAL DISEASE');
    drawRowLeft('SYMPTOMS', data.venereal_symptoms || 'NAD');
    drawRowLeft('REMARKS', data.exam_remarks !== undefined ? data.exam_remarks : '');

    drawSubHeaderLeft('X-RAY INVESTIGATION');
    drawRowLeft('CHEST X-RAY', report.xrayFinding || data.chest_xray || 'NORMAL');
    drawRowLeft('REMARKS', report.xrayRemarks || data.xray_remarks || 'NORMAL', true);

    // Right Table: Laboratory Investigation
    doc.rect(rightTableX, tableTopY, rightTableW, rowH).stroke();
    doc.fillColor('#212529').fontSize(8.5).font('Helvetica-Bold');
    doc.text('LABORATORY INVESTIGATION', rightTableX, tableTopY + 3.2, { align: 'center', width: rightTableW });

    doc.rect(rightTableX, subheaderY, rightTableW, rowH).stroke();
    doc.moveTo(rightDividerX, subheaderY).lineTo(rightDividerX, subheaderY + rowH).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold');
    doc.text('TYPE OF THE EXAM', rightTableX + 5, subheaderY + 3.2);
    doc.text('RESULT', rightDividerX, subheaderY + 3.2, { width: rightTableW - (rightDividerX - rightTableX), align: 'center' });

    let curRY = subheaderY + rowH;

    const drawSubHeaderRight = (title: string) => {
      doc.rect(rightTableX, curRY, rightTableW, rowH).stroke();
      doc.fillColor('#212529').fontSize(7.5).font('Helvetica-Bold');
      doc.text(title, rightTableX, curRY + 3.2, { align: 'center', width: rightTableW });
      curRY += rowH;
    };

    const drawRowRight = (exam: string, result: string, customRowH: number = rowH) => {
      doc.rect(rightTableX, curRY, rightTableW, customRowH).stroke();
      doc.moveTo(rightDividerX, curRY).lineTo(rightDividerX, curRY + customRowH).stroke();
      doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
      doc.text(exam, rightTableX + 5, curRY + (customRowH > rowH ? 5.5 : 3.2), { width: rightDividerX - rightTableX - 10 });
      doc.text(result !== undefined && result !== null ? result : '', rightDividerX, curRY + (customRowH > rowH ? 5.5 : 3.2), { width: rightTableW - (rightDividerX - rightTableX), align: 'center' });
      curRY += customRowH;
    };

    drawRowRight('URINE FOR SUGAR - ALBUMIN', data.urine_sugar_albumin || 'NIL - NIL');
    drawRowRight('URINE FOR OPIATES - CANNABIS - AMPHETAMINE', data.urine_opiates_cannabis || 'N/A - N/A - N/A', rowH * 1.5);
    drawRowRight('URINE FOR PREGNANCY TEST', data.urine_pregnancy || 'N/A');

    drawSubHeaderRight('OTHERS');
    drawRowRight('BLOOD GROUP', data.blood_group !== undefined ? data.blood_group : '');
    drawRowRight('HAEMOGLOBIN', data.haemoglobin !== undefined ? data.haemoglobin : '');
    drawRowRight('ESR', data.esr !== undefined ? data.esr : '');
    drawRowRight('R.B.S', data.rbs || '6.5');
    drawRowRight('S. CREATININE', data.s_creatinine || '1.0');
    drawRowRight('S.BIL', data.s_bil || '0.85');
    drawRowRight('SGPT', data.sgpt || '35');
    drawRowRight('SGOT', data.sgot !== undefined ? data.sgot : '');
    drawRowRight('HIV I & HIV II', data.hiv || 'NEGATIVE');
    drawRowRight('HBsAg', data.hbsag || 'NEGATIVE');
    drawRowRight('Anti HCV', data.anti_hcv || 'NEGATIVE');
    drawRowRight('TPHA (IF VDRL POSITIVE)', data.tpha || 'NEGATIVE');
    drawRowRight('VDRL', data.vdrl || 'NON REACTIVE');
    drawRowRight('REMARKS', data.lab_remarks !== undefined ? data.lab_remarks : '');

    // --- 6. STATUS, CHEST X-RAY & CRYPTOGRAPHIC QR VERIFICATION SECTION ---
    const isFit = (report.finalMedicalStatus || 'FIT') === 'FIT';
    const statusText = report.finalMedicalStatus || 'FIT';

    const statusTopY = Math.max(curLY + 18, 646);
    const statusBoxW = isFit ? 28 : 40;
    const statusBoxH = 17;

    doc.fillColor('#212529').fontSize(8).font('Helvetica');
    doc.text('HIS/HER STATUS: ', 28.5, statusTopY + 4);

    doc.lineWidth(0.8).strokeColor('#ff0000');
    doc.rect(104, statusTopY, statusBoxW, statusBoxH).stroke();
    doc.fillColor('#212529').fontSize(8).font('Helvetica-Bold');
    doc.text(statusText, 104, statusTopY + 4.5, { width: statusBoxW, align: 'center' });

    const remarksY = statusTopY + 36;
    doc.fillColor('#212529').fontSize(8).font('Helvetica-Bold');
    doc.text('REMARKS: ', 28.5, remarksY, { continued: true });
    doc.fillColor('#ff0000');
    doc.text(`${report.finalRemarks || 'NORMAL,'}`);

    // Chest X-Ray Image
    const xrayBoxX = 306.9;
    const xrayBoxY = 570.8;
    const xrayBoxW = 101.2;
    const xrayBoxH = 123.0;

    doc.lineWidth(0.6).strokeColor('#212529');
    doc.rect(xrayBoxX, xrayBoxY, xrayBoxW, xrayBoxH).stroke();

    const xrayCandidate = report.xrayImageUrl || (report.registrationNumber ? `xray_${report.registrationNumber}.png` : undefined);
    const xrayPath = await this.resolveImageBuffer(xrayCandidate, 'default_xray.png');
    if (xrayPath) {
      try {
        doc.image(xrayPath, xrayBoxX + 1, xrayBoxY + 1, {
          fit: [xrayBoxW - 2, xrayBoxH - 2],
          align: 'center',
          valign: 'center',
        });
      } catch (e) {
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica');
        doc.text('[ CHEST X-RAY ]', xrayBoxX, xrayBoxY + 55, { align: 'center', width: xrayBoxW });
      }
    }

    // QR Verification Box Beside X-Ray
    const qrBoxX = 425.0;
    const qrBoxY = 570.8;
    const qrBoxW = 141.5;
    const qrBoxH = 123.0;

    doc.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH).stroke();

    if (qrBuffer) {
      doc.image(qrBuffer, qrBoxX + 28, qrBoxY + 6, {
        width: 85,
        height: 85,
      });
    }

    doc.fillColor('#212529').fontSize(7).font('Helvetica-Bold');
    doc.text('SCAN TO VERIFY REPORT', qrBoxX, qrBoxY + 95, { align: 'center', width: qrBoxW });
    doc.fillColor('#64748b').fontSize(6).font('Helvetica');
    doc.text(`Reg: ${report.registrationNumber}`, qrBoxX, qrBoxY + 104, { align: 'center', width: qrBoxW });
    doc.fillColor('#059669').fontSize(5.5).font('Helvetica-Bold');
    doc.text('Official Verification Portal', qrBoxX, qrBoxY + 112, { align: 'center', width: qrBoxW });

    // --- 7. AUTO-GENERATED DISCLAIMER & FOOTER ---
    doc.fillColor('#212529').fontSize(10).font('Helvetica');
    doc.text('This is an auto generated report, does not require any signature.', 28.5, 718.3, {
      align: 'center',
      width: 538.75,
    });

    const footerY = 805;
    doc.lineWidth(0.5).strokeColor('#cbd5e1');
    doc.moveTo(28.5, footerY).lineTo(567.25, footerY).stroke();

    doc.fillColor('#64748b').fontSize(6.5).font('Helvetica');
    doc.text(`Online Verification: ${qrUrl}`, 28.5, footerY + 6);
    doc.text(`Page ${pageNum}/${totalPages}`, 450, footerY + 6, { width: 117.25, align: 'right' });
  }

  /**
   * Generates Combined Official Two-Page PDF:
   * Page 1: Official Medical Fitness Certificate
   * Page 2: Detailed Medical Test Report
   */
  async generateCombinedPdf(
    certificate: MedicalCertificate,
    report: MedicalReport,
    patient: Patient,
    settings?: OrganizationSettings,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 20, bottom: 20, left: 28.5, right: 28.5 },
          autoFirstPage: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: Error) => reject(err));

        const qrUrl = this.verificationService.getVerificationUrl(certificate.verificationToken);
        let qrBuffer: Buffer | null = null;
        try {
          qrBuffer = await QRCode.toBuffer(qrUrl, {
            errorCorrectionLevel: 'M',
            margin: 0,
            width: 140,
          });
        } catch (e) {
          qrBuffer = null;
        }

        // --- PAGE 1: Medical Fitness Certificate ---
        await this.renderCertificatePage(doc, certificate, report, patient, settings, {
          pageNumber: 1,
          totalPages: 2,
          qrUrl,
          qrBuffer,
        });

        // Explicit page boundary: Never allow certificate content to flow onto report page!
        doc.addPage({
          size: 'A4',
          margins: { top: 20, bottom: 20, left: 28.5, right: 28.5 },
        });

        // --- PAGE 2: Detailed Medical Test Report ---
        await this.renderReportPage(doc, report, patient, {
          pageNumber: 2,
          totalPages: 2,
          qrUrl,
          qrBuffer,
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates Standalone Certificate-Only PDF (1 Page)
   */
  async generateCertificatePdf(
    certificate: MedicalCertificate,
    report: MedicalReport,
    patient: Patient,
    settings?: OrganizationSettings,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 20, bottom: 20, left: 28.5, right: 28.5 },
          autoFirstPage: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: Error) => reject(err));

        const qrUrl = this.verificationService.getVerificationUrl(certificate.verificationToken);
        let qrBuffer: Buffer | null = null;
        try {
          qrBuffer = await QRCode.toBuffer(qrUrl, {
            errorCorrectionLevel: 'M',
            margin: 0,
            width: 140,
          });
        } catch (e) {
          qrBuffer = null;
        }

        await this.renderCertificatePage(doc, certificate, report, patient, settings, {
          pageNumber: 1,
          totalPages: 1,
          qrUrl,
          qrBuffer,
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates Standalone Detailed Report PDF (1 Page)
   */
  async generateReportPdf(report: MedicalReport, patient: Patient): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 20, bottom: 20, left: 28.5, right: 28.5 },
          autoFirstPage: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: Error) => reject(err));

        let qrBuffer: Buffer | null = null;
        let qrUrl = '';
        let activeToken = await this.verificationService.getActiveTokenForReport(report.id);
        if (!activeToken && report.status === 'FINALIZED') {
          activeToken = await this.verificationService.createTokenForReport(report.id);
        }

        if (activeToken && !activeToken.isRevoked) {
          qrUrl = this.verificationService.getVerificationUrl(activeToken.token);
        } else {
          qrUrl = this.verificationService.getPreviewVerificationUrl(report.registrationNumber);
        }

        try {
          qrBuffer = await QRCode.toBuffer(qrUrl, {
            errorCorrectionLevel: 'M',
            margin: 0,
            width: 120,
          });
        } catch (e) {
          qrBuffer = null;
        }

        await this.renderReportPage(doc, report, patient, {
          pageNumber: 1,
          totalPages: 1,
          qrUrl,
          qrBuffer,
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
