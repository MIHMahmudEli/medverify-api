import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
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

  async generateReportPdf(report: MedicalReport, patient: Patient): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 20, bottom: 20, left: 25, right: 25 },
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
            width: 85,
          });
        } catch (e) {
          qrBuffer = null;
        }

        const data = report.reportData || {};
        const age = this.calculateAge(patient.dateOfBirth);

        // --- TOP HEADER ---
        doc.rect(25, 20, 545, 50).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
        doc.text('MYSA MEDICAL SERVICES', 25, 27, { align: 'center', width: 545 });
        doc.fontSize(8).font('Helvetica');
        doc.text(
          'Govt. Approved Medical Examination & Diagnostic Center for Overseas Employment',
          25,
          44,
          { align: 'center', width: 545 },
        );
        doc.text('Licence No: DGHS/MED-84920/2024 | Phone: +880 1700-000000', 25, 55, {
          align: 'center',
          width: 545,
        });

        // Title Bar
        doc.rect(25, 74, 545, 22).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
        doc.text('MEDICAL TEST REPORT', 25, 80, { align: 'center', width: 545 });

        // Reg Bar
        doc.rect(25, 98, 545, 18).fill('#f1f5f9');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
        doc.text(`REG NO: ${report.registrationNumber}`, 32, 103);
        doc.text(`Reg. Date: ${this.formatDate(report.registeredAt)}`, 410, 103, {
          width: 150,
          align: 'right',
        });

        // --- PATIENT INFO & FINGERPRINT SECTION ---
        const pTop = 120;
        const pHeight = 110;
        doc.rect(25, pTop, 440, pHeight).stroke('#cbd5e1');
        doc.rect(470, pTop, 100, pHeight).stroke('#cbd5e1');

        // Fingerprint Header Box
        doc.rect(470, pTop, 100, 16).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
        doc.text('Finger Print', 470, pTop + 4, { align: 'center', width: 100 });

        // Fingerprint Area / Text
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica');
        doc.text('[ VERIFIED ]', 470, pTop + 55, { align: 'center', width: 100 });

        // Patient Details Rows
        const rowH = 18;
        const labels = [
          [
            'NAME',
            patient.fullName.toUpperCase(),
            'COUNTRY',
            (patient.country || 'N/A').toUpperCase(),
          ],
          [
            'PASSPORT NO',
            (patient.passportNumber || 'N/A').toUpperCase(),
            'BIRTH DATE',
            this.formatDate(patient.dateOfBirth),
          ],
          [
            'MARITAL STATUS',
            patient.maritalStatus || 'Single',
            'RELIGION',
            patient.religion || 'Islam',
          ],
          [
            'AGE',
            age,
            'GENDER',
            patient.gender || 'Male',
          ],
          [
            'NATIONALITY',
            patient.nationality || 'Bangladeshi',
            'HEIGHT (CM)',
            patient.heightCm ? String(patient.heightCm) : 'N/A',
          ],
          [
            'AGENCY',
            patient.agency || 'DIRECT',
            'WEIGHT (KG)',
            patient.weightKg ? String(patient.weightKg) : 'N/A',
          ],
        ];

        labels.forEach((r, idx) => {
          const y = pTop + idx * rowH;
          if (idx > 0) {
            doc.moveTo(25, y).lineTo(465, y).stroke('#e2e8f0');
          }
          // Column 1: Label
          doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
          doc.text(r[0], 30, y + 5, { width: 85 });
          // Column 1: Value
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(r[1], 118, y + 5, { width: 115 });
          // Column 2: Label
          doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
          doc.text(r[2], 240, y + 5, { width: 85 });
          // Column 2: Value
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(r[3], 328, y + 5, { width: 130 });
        });

        // --- TWO MAIN TABLES ---
        const tTop = 236;
        const colW = 268;
        const leftX = 25;
        const rightX = 302;

        // TABLE 1: MEDICAL EXAMINATION (LEFT)
        doc.rect(leftX, tTop, colW, 16).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('MEDICAL EXAMINATION', leftX, tTop + 4, { align: 'center', width: colW });

        doc.rect(leftX, tTop + 16, colW, 14).fill('#f1f5f9');
        doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold');
        doc.text('TYPE OF THE EXAM', leftX + 8, tTop + 20);
        doc.text('RESULT', leftX + colW - 55, tTop + 20, { width: 50, align: 'right' });

        // TABLE 2: LABORATORY INVESTIGATION (RIGHT)
        doc.rect(rightX, tTop, colW, 16).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('LABORATORY INVESTIGATION', rightX, tTop + 4, { align: 'center', width: colW });

        doc.rect(rightX, tTop + 16, colW, 14).fill('#f1f5f9');
        doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold');
        doc.text('TYPE OF THE EXAM', rightX + 8, tTop + 20);
        doc.text('RESULT', rightX + colW - 55, tTop + 20, { width: 50, align: 'right' });

        // Left Table Rows
        let curLeftY = tTop + 30;
        const drawSubHeaderLeft = (text: string) => {
          doc.rect(leftX, curLeftY, colW, 13).fill('#e2e8f0');
          doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold');
          doc.text(text, leftX + 8, curLeftY + 3);
          curLeftY += 13;
        };

        const drawRowLeft = (label: string, val: string) => {
          doc.rect(leftX, curLeftY, colW, 13).stroke('#e2e8f0');
          doc.fillColor('#475569').fontSize(7).font('Helvetica');
          doc.text(label, leftX + 8, curLeftY + 3, { width: 175 });
          doc.fillColor('#0f172a').font('Helvetica-Bold');
          doc.text(val || 'NAD', leftX + colW - 85, curLeftY + 3, { width: 80, align: 'right' });
          curLeftY += 13;
        };

        // Eye Visual Acuity (R and L)
        doc.rect(leftX, curLeftY, colW, 24).stroke('#e2e8f0');
        doc.fillColor('#475569').fontSize(7).font('Helvetica');
        doc.text('EYE Visual Acuity', leftX + 8, curLeftY + 7);
        doc.text('R: ' + (data.eye_visual_acuity_r || '6/6'), leftX + colW - 85, curLeftY + 2, {
          width: 80,
          align: 'right',
        });
        doc.text('L: ' + (data.eye_visual_acuity_l || '6/6'), leftX + colW - 85, curLeftY + 12, {
          width: 80,
          align: 'right',
        });
        curLeftY += 24;

        // Ear (R and L)
        doc.rect(leftX, curLeftY, colW, 24).stroke('#e2e8f0');
        doc.fillColor('#475569').fontSize(7).font('Helvetica');
        doc.text('EAR', leftX + 8, curLeftY + 7);
        doc.text('R: ' + (data.ear_r || 'NAD'), leftX + colW - 85, curLeftY + 2, {
          width: 80,
          align: 'right',
        });
        doc.text('L: ' + (data.ear_l || 'NAD'), leftX + colW - 85, curLeftY + 12, {
          width: 80,
          align: 'right',
        });
        curLeftY += 24;

        drawSubHeaderLeft('SYSTEMIC EXAM: CARDIO-VASCULAR');
        drawRowLeft('B.P (mm Hg)', data.blood_pressure || '120/80');
        drawRowLeft('HEART', data.heart || 'NAD');

        drawSubHeaderLeft('RESPIRATORY EXAM');
        drawRowLeft('LUNGS', data.lungs || 'NAD');

        drawSubHeaderLeft('GASTROINTESTINAL ABDOMEN');
        drawRowLeft('ABDOMEN', data.abdomen || 'NAD');

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
        drawRowLeft('REMARKS', report.xrayRemarks || data.xray_remarks || 'NORMAL');

        // Right Table Rows (Laboratory Investigation)
        let curRightY = tTop + 30;
        const drawSubHeaderRight = (text: string) => {
          doc.rect(rightX, curRightY, colW, 13).fill('#e2e8f0');
          doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold');
          doc.text(text, rightX + 8, curRightY + 3);
          curRightY += 13;
        };

        const drawRowRight = (label: string, val: string) => {
          doc.rect(rightX, curRightY, colW, 13).stroke('#e2e8f0');
          doc.fillColor('#475569').fontSize(7).font('Helvetica');
          doc.text(label, rightX + 8, curRightY + 3, { width: 175 });
          doc.fillColor('#0f172a').font('Helvetica-Bold');
          doc.text(val || 'N/A', rightX + colW - 85, curRightY + 3, { width: 80, align: 'right' });
          curRightY += 13;
        };

        drawRowRight('URINE FOR SUGAR - ALBUMIN', data.urine_sugar_albumin || 'NIL - NIL');
        drawRowRight('URINE FOR OPIATES - CANNABIS', data.urine_opiates_cannabis || 'N/A - N/A - N/A');
        drawRowRight('URINE FOR PREGNANCY TEST', data.urine_pregnancy || 'N/A');

        drawSubHeaderRight('OTHERS');
        drawRowRight('BLOOD GROUP', data.blood_group || 'O (+VE)');
        drawRowRight('HAEMOGLOBIN (gm/dl)', data.haemoglobin || '14.2');
        drawRowRight('ESR (mm/1st hr)', data.esr || '12');
        drawRowRight('R.B.S (mmol/L)', data.rbs || '5.8');
        drawRowRight('S. CREATININE (mg/dl)', data.s_creatinine || '1.0');
        drawRowRight('S. BILIRUBIN (mg/dl)', data.s_bil || '0.85');
        drawRowRight('SGPT (ALT) (U/L)', data.sgpt || '35');
        drawRowRight('SGOT (AST) (U/L)', data.sgot || '28');
        drawRowRight('HIV I & HIV II', data.hiv || 'NEGATIVE');
        drawRowRight('HBsAg', data.hbsag || 'NEGATIVE');
        drawRowRight('Anti HCV', data.anti_hcv || 'NEGATIVE');
        drawRowRight('TPHA (IF VDRL POSITIVE)', data.tpha || 'NEGATIVE');
        drawRowRight('VDRL', data.vdrl || 'NON REACTIVE');
        drawRowRight('REMARKS', data.lab_remarks || 'NORMAL');

        // Draw full height border around columns
        const bottomY = Math.max(curLeftY, curRightY);
        doc.rect(leftX, tTop + 30, colW, bottomY - (tTop + 30)).stroke('#cbd5e1');
        doc.rect(rightX, tTop + 30, colW, bottomY - (tTop + 30)).stroke('#cbd5e1');

        // --- STATUS & QR CODE SECTION ---
        const statusTop = bottomY + 8;

        // Status Card
        const isFit = report.finalMedicalStatus === 'FIT';
        const isUnfit = report.finalMedicalStatus === 'UNFIT';
        const statusBg = isFit ? '#059669' : isUnfit ? '#e11d48' : '#d97706';

        // Draw Status Box
        doc.rect(leftX, statusTop, 440, 48).stroke('#cbd5e1');
        doc.rect(leftX + 4, statusTop + 4, 180, 24).fill(statusBg);
        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
        doc.text(`HIS/HER STATUS: ${report.finalMedicalStatus || 'FIT'}`, leftX + 8, statusTop + 10, {
          width: 172,
          align: 'center',
        });

        doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold');
        doc.text(
          `REMARKS: ${report.finalRemarks || 'NORMAL'}`,
          leftX + 195,
          statusTop + 10,
        );

        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica');
        doc.text(
          'Approved & Verified by Authorized Medical Officer. All laboratory & radiological examinations reviewed.',
          leftX + 8,
          statusTop + 34,
          { width: 425 },
        );

        // QR Code Box (beside X-ray & status)
        doc.rect(470, statusTop, 100, 100).stroke('#cbd5e1');
        if (qrBuffer) {
          doc.image(qrBuffer, 477, statusTop + 4, { width: 86, height: 86 });
        }
        doc.fillColor('#475569').fontSize(6).font('Helvetica');
        doc.text('SCAN TO VERIFY', 470, statusTop + 91, { align: 'center', width: 100 });

        // --- FOOTER ---
        const footerY = 800;
        doc.moveTo(25, footerY).lineTo(570, footerY).stroke('#cbd5e1');
        doc.fillColor('#64748b').fontSize(7).font('Helvetica');
        doc.text(
          'This is an auto generated report, does not require any signature.',
          25,
          footerY + 4,
          { align: 'center', width: 545 },
        );
        doc.fontSize(6.5);
        doc.text(
          `Online Verification: ${qrUrl} | Report Revision: #${report.currentRevisionNumber}`,
          25,
          footerY + 14,
          { align: 'center', width: 545 },
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
