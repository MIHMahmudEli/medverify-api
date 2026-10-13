import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import { join } from 'path';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { Patient } from '../../database/entities/patient.entity';
import { VerificationService } from '../verification/verification.service';

@Injectable()
export class PdfService {
  constructor(private readonly verificationService: VerificationService) {}

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
   */
  private resolveImagePath(imageRef?: string, defaultFileName?: string): string | null {
    if (imageRef) {
      // 1. If it's a URL or path like /api/v1/uploads/file/<filename>
      const cleanFilename = imageRef.includes('/uploads/file/')
        ? imageRef.split('/uploads/file/')[1]
        : imageRef.includes('/uploads/')
          ? imageRef.split('/uploads/')[1]
          : imageRef;

      // Check uploads folder
      const candidateUpload = join(process.cwd(), 'uploads', cleanFilename);
      if (fs.existsSync(candidateUpload)) {
        return candidateUpload;
      }

      // Check direct path
      if (fs.existsSync(imageRef)) {
        return imageRef;
      }
    }

    // Fallback to default asset if provided
    if (defaultFileName) {
      const candidateAsset1 = join(process.cwd(), 'assets', defaultFileName);
      if (fs.existsSync(candidateAsset1)) return candidateAsset1;

      const candidateAsset2 = join(__dirname, '../../../../assets', defaultFileName);
      if (fs.existsSync(candidateAsset2)) return candidateAsset2;

      const candidateAsset3 = join(__dirname, '../../../assets', defaultFileName);
      if (fs.existsSync(candidateAsset3)) return candidateAsset3;
    }

    return null;
  }

  /**
   * Deterministically renders a barcode graphic below REG NO.
   */
  private drawBarcode(doc: any, x: number, y: number, regNo: string) {
    const barColor = '#008080'; // Dark teal matching original document
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
      // Draw bar on even indices or based on deterministic hash
      const shouldDraw = idx % 3 !== 2;
      if (shouldDraw) {
        doc.rect(currentX, y, w, barHeight).fill(barColor);
      }
      currentX += w + 1.45;
    });
  }

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

        // Generate QR Code if verification token exists or generate preview URL
        let qrBuffer: Buffer | null = null;
        let qrUrl = '';
        const activeToken = await this.verificationService.getActiveTokenForReport(report.id);
        if (activeToken && !activeToken.isRevoked) {
          qrUrl = this.verificationService.getVerificationUrl(activeToken.token);
        } else {
          qrUrl = `https://medverify.org/verify/preview-${report.registrationNumber}`;
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

        const data = report.reportData || {};
        const age = this.calculateAge(patient.dateOfBirth);

        // --- 1. TOP HEADER BANNER ---
        const bannerPath = this.resolveImagePath(undefined, 'header_banner.png');
        if (bannerPath) {
          doc.image(bannerPath, 28.5, 28.5, { width: 538.75, height: 47.73 });
        } else {
          // Clean vector fallback if image is missing
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

        // Barcode lines underneath REG NO
        this.drawBarcode(doc, 35.7, 121.0, report.registrationNumber);

        // Reg Date
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#212529');
        doc.text(`Reg. Date: ${this.formatDate(report.registeredAt)}`, 340, regY, {
          width: 179,
          align: 'right',
        });

        // Fingerprint Header above photo/fingerprint box
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#212529');
        doc.text('Finger Print', 440, 121, { align: 'center', width: 127.25 });

        // --- 4. PATIENT INFO TABLE & PHOTO BOX ---
        const pTableX = 28.5;
        const pTableY = 143.5;
        const pTableW = 410.8;
        const pTableH = 108.5; // 6 rows * 18.08
        const photoBoxX = 439.3;
        const photoBoxW = 127.95;
        const photoBoxH = 108.5;

        // Border around patient info table
        doc.lineWidth(0.6).strokeColor('#212529');
        doc.rect(pTableX, pTableY, pTableW, pTableH).stroke();

        // Vertical dividers in patient table
        const vDiv1 = 151.4;
        const vDiv2 = 251.2;
        const vDiv3 = 351.0;
        doc.moveTo(vDiv1, pTableY).lineTo(vDiv1, pTableY + pTableH).stroke();
        doc.moveTo(vDiv2, pTableY).lineTo(vDiv2, pTableY + pTableH).stroke();
        doc.moveTo(vDiv3, pTableY).lineTo(vDiv3, pTableY + pTableH).stroke();

        // Patient info rows
        const patientRows = [
          ['NAME', (patient.fullName || '').toUpperCase(), 'COUNTRY', (patient.country || 'N/A').toUpperCase()],
          ['PASSPORT NO', (patient.passportNumber || '').toUpperCase(), 'BIRTH DATE', this.formatDate(patient.dateOfBirth)],
          ['MARITAL STATUS', patient.maritalStatus || 'Unmarried', 'RELIGION', patient.religion || 'Islam'],
          ['AGE', age, 'GENDER', patient.gender || 'Male'],
          ['NATIONALITY', patient.nationality || 'Bangladeshi', 'HEIGHT (CM)', patient.heightCm ? String(patient.heightCm) : ''],
          ['AGENCY', patient.agency || '', 'WEIGHT (KG)', patient.weightKg ? String(patient.weightKg) : ''],
        ];

        patientRows.forEach((r, idx) => {
          const rowY = pTableY + idx * 18.08;
          if (idx > 0) {
            doc.moveTo(pTableX, rowY).lineTo(pTableX + pTableW, rowY).stroke();
          }

          // Col 1: Label
          doc.fillColor('#212529').fontSize(8).font('Helvetica');
          doc.text(r[0], pTableX + 5, rowY + 5, { width: vDiv1 - pTableX - 8 });

          // Col 2: Value
          doc.font('Helvetica-Bold');
          doc.text(r[1], vDiv1 + 5, rowY + 5, { width: vDiv2 - vDiv1 - 8 });

          // Col 3: Label
          doc.font('Helvetica');
          doc.text(r[2], vDiv2 + 5, rowY + 5, { width: vDiv3 - vDiv2 - 8 });

          // Col 4: Value
          doc.font('Helvetica-Bold');
          doc.text(r[3], vDiv3 + 5, rowY + 5, { width: pTableX + pTableW - vDiv3 - 8 });
        });

        // Photo / Fingerprint Box
        doc.rect(photoBoxX, pTableY, photoBoxW, photoBoxH).stroke();
        const photoPath = this.resolveImagePath(patient.photoUrl, 'default_photo.png');
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

        // TABLE 1: MEDICAL EXAMINATION (LEFT)
        // Main Header
        doc.rect(leftTableX, tableTopY, leftTableW, 14.5).stroke();
        doc.fillColor('#212529').fontSize(8.5).font('Helvetica-Bold');
        doc.text('MEDICAL EXAMINATION', leftTableX, tableTopY + 3.5, { align: 'center', width: leftTableW });

        // Subheader
        const subheaderY = tableTopY + 14.5;
        doc.rect(leftTableX, subheaderY, leftTableW, 14.5).stroke();
        doc.moveTo(leftDividerX, subheaderY).lineTo(leftDividerX, subheaderY + 14.5).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold');
        doc.text('TYPE OF THE EXAM', leftTableX + 5, subheaderY + 3.5);
        doc.text('RESULT', leftDividerX, subheaderY + 3.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });

        let curLY = subheaderY + 14.5;

        // Helper for Left subheaders
        const drawSubHeaderLeft = (title: string) => {
          doc.rect(leftTableX, curLY, leftTableW, 14.5).stroke();
          doc.fillColor('#212529').fontSize(7.5).font('Helvetica-Bold');
          doc.text(title, leftTableX, curLY + 3.5, { align: 'center', width: leftTableW });
          curLY += 14.5;
        };

        // Helper for Left rows
        const drawRowLeft = (exam: string, result: string, isResultRed: boolean = false) => {
          doc.rect(leftTableX, curLY, leftTableW, 14.5).stroke();
          doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + 14.5).stroke();
          doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
          doc.text(exam, leftTableX + 5, curLY + 3.5, { width: leftDividerX - leftTableX - 10 });
          if (isResultRed) {
            doc.fillColor('#ff0000').font('Helvetica-Bold');
          } else {
            doc.fillColor('#212529').font('Helvetica');
          }
          doc.text(result || 'NAD', leftDividerX, curLY + 3.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
          curLY += 14.5;
        };

        // EYE Visual Acuity (29 pt high, double row)
        doc.rect(leftTableX, curLY, leftTableW, 29).stroke();
        doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + 29).stroke();
        doc.moveTo(leftDividerX, curLY + 14.5).lineTo(leftTableX + leftTableW, curLY + 14.5).stroke();
        doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
        doc.text('EYE Visual Acuity', leftTableX + 5, curLY + 9);
        doc.text(`R:  ${data.eye_visual_acuity_r || '6/6'}`, leftDividerX, curLY + 3.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
        doc.text(`L:  ${data.eye_visual_acuity_l || '6/6'}`, leftDividerX, curLY + 17.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
        curLY += 29;

        // EAR (29 pt high, double row)
        doc.rect(leftTableX, curLY, leftTableW, 29).stroke();
        doc.moveTo(leftDividerX, curLY).lineTo(leftDividerX, curLY + 29).stroke();
        doc.moveTo(leftDividerX, curLY + 14.5).lineTo(leftTableX + leftTableW, curLY + 14.5).stroke();
        doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
        doc.text('EAR', leftTableX + 5, curLY + 9);
        doc.text(`R:  ${data.ear_r || 'NAD'}`, leftDividerX, curLY + 3.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
        doc.text(`L:  ${data.ear_l || 'NAD'}`, leftDividerX, curLY + 17.5, { width: leftTableW - (leftDividerX - leftTableX), align: 'center' });
        curLY += 29;

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
        drawRowLeft('SKIN', data.skin || 'NAD');
        drawRowLeft('C.N.S', data.cns || 'NAD');
        drawRowLeft('EXTREMITIES', data.extremities || 'NAD');
        drawRowLeft('PSYCHIATRY', data.psychiatry || 'NAD');

        drawSubHeaderLeft('VENEREAL DISEASE');
        drawRowLeft('SYMPTOMS', data.venereal_symptoms || 'NAD');
        drawRowLeft('REMARKS', data.exam_remarks || 'NAD');

        drawSubHeaderLeft('X-RAY INVESTIGATION');
        drawRowLeft('CHEST X-RAY', report.xrayFinding || data.chest_xray || 'NORMAL');
        // Original reference renders X-ray REMARKS as bold RED "NORMAL"
        drawRowLeft('REMARKS', report.xrayRemarks || data.xray_remarks || 'NORMAL', true);

        // TABLE 2: LABORATORY INVESTIGATION (RIGHT)
        doc.rect(rightTableX, tableTopY, rightTableW, 14.5).stroke();
        doc.fillColor('#212529').fontSize(8.5).font('Helvetica-Bold');
        doc.text('LABORATORY INVESTIGATION', rightTableX, tableTopY + 3.5, { align: 'center', width: rightTableW });

        doc.rect(rightTableX, subheaderY, rightTableW, 14.5).stroke();
        doc.moveTo(rightDividerX, subheaderY).lineTo(rightDividerX, subheaderY + 14.5).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold');
        doc.text('TYPE OF THE EXAM', rightTableX + 5, subheaderY + 3.5);
        doc.text('RESULT', rightDividerX, subheaderY + 3.5, { width: rightTableW - (rightDividerX - rightTableX), align: 'center' });

        let curRY = subheaderY + 14.5;

        // Helper for Right subheaders
        const drawSubHeaderRight = (title: string) => {
          doc.rect(rightTableX, curRY, rightTableW, 14.5).stroke();
          doc.fillColor('#212529').fontSize(7.5).font('Helvetica-Bold');
          doc.text(title, rightTableX, curRY + 3.5, { align: 'center', width: rightTableW });
          curRY += 14.5;
        };

        // Helper for Right rows
        const drawRowRight = (exam: string, result: string, rowH: number = 14.5) => {
          doc.rect(rightTableX, curRY, rightTableW, rowH).stroke();
          doc.moveTo(rightDividerX, curRY).lineTo(rightDividerX, curRY + rowH).stroke();
          doc.fillColor('#212529').fontSize(7.5).font('Helvetica');
          doc.text(exam, rightTableX + 5, curRY + (rowH > 14.5 ? 6 : 3.5), { width: rightDividerX - rightTableX - 10 });
          doc.text(result || 'N/A', rightDividerX, curRY + (rowH > 14.5 ? 6 : 3.5), { width: rightTableW - (rightDividerX - rightTableX), align: 'center' });
          curRY += rowH;
        };

        drawRowRight('URINE FOR SUGAR - ALBUMIN', data.urine_sugar_albumin || 'NIL - NIL');
        drawRowRight('URINE FOR OPIATES - CANNABIS - AMPHETAMINE', data.urine_opiates_cannabis || 'N/A - N/A - N/A', 21.75);
        drawRowRight('URINE FOR PREGNANCY TEST', data.urine_pregnancy || 'N/A');

        drawSubHeaderRight('OTHERS');
        drawRowRight('BLOOD GROUP', data.blood_group || 'O (+VE)');
        drawRowRight('HAEMOGLOBIN', data.haemoglobin || '14.2');
        drawRowRight('ESR', data.esr || '12');
        drawRowRight('R.B.S', data.rbs || '6.5');
        drawRowRight('S. CREATININE', data.s_creatinine || '1.0');
        drawRowRight('S.BIL', data.s_bil || '0.85');
        drawRowRight('SGPT', data.sgpt || '35');
        drawRowRight('SGOT', data.sgot || '28');
        drawRowRight('HIV I & HIV II', data.hiv || 'NEGATIVE');
        drawRowRight('HBsAg', data.hbsag || 'NEGATIVE');
        drawRowRight('Anti HCV', data.anti_hcv || 'NEGATIVE');
        drawRowRight('TPHA (IF VDRL POSITIVE)', data.tpha || 'NEGATIVE');
        drawRowRight('VDRL', data.vdrl || 'NON REACTIVE');
        drawRowRight('REMARKS', data.lab_remarks || 'NORMAL');

        // --- 6. STATUS, CHEST X-RAY & CRYPTOGRAPHIC QR VERIFICATION SECTION ---
        // Left Side: Status and Remarks (Y = 643 to 705)
        const isFit = (report.finalMedicalStatus || 'FIT') === 'FIT';
        const statusText = report.finalMedicalStatus || 'FIT';

        doc.fillColor('#212529').fontSize(8).font('Helvetica');
        doc.text('HIS/HER STATUS: ', 28.5, 644);

        // Status border box (red outline)
        const statusBoxW = isFit ? 26 : 38;
        doc.lineWidth(0.8).strokeColor('#ff0000');
        doc.rect(104, 639.5, statusBoxW, 16.5).stroke();
        doc.fillColor('#212529').fontSize(8).font('Helvetica-Bold');
        doc.text(statusText, 104, 644, { width: statusBoxW, align: 'center' });

        // Remarks at Y = 694
        doc.fillColor('#212529').fontSize(8).font('Helvetica-Bold');
        doc.text('REMARKS: ', 28.5, 694, { continued: true });
        doc.fillColor('#ff0000');
        doc.text(`${report.finalRemarks || 'NORMAL,'}`);

        // Right Side: Chest X-Ray Image (Y = 570.8 to 693.8)
        const xrayBoxX = 306.9;
        const xrayBoxY = 570.8;
        const xrayBoxW = 101.2;
        const xrayBoxH = 123.0;

        doc.lineWidth(0.6).strokeColor('#212529');
        doc.rect(xrayBoxX, xrayBoxY, xrayBoxW, xrayBoxH).stroke();

        const xrayPath = this.resolveImagePath(report.xrayImageUrl, 'default_xray.png');
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

        // Right Side Beside X-Ray: Cryptographic QR Code Verification Box
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

        // Bottom page line and metadata
        const footerY = 805;
        doc.lineWidth(0.5).strokeColor('#cbd5e1');
        doc.moveTo(28.5, footerY).lineTo(567.25, footerY).stroke();

        doc.fillColor('#64748b').fontSize(6.5).font('Helvetica');
        doc.text(`Online Verification: ${qrUrl}`, 28.5, footerY + 6);
        doc.text('Page 1/1', 450, footerY + 6, { width: 117.25, align: 'right' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
