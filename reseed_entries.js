const { Client } = require('./node_modules/pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('./node_modules/uuid');
require('./node_modules/dotenv').config({ path: './.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const entries = [
  {
    regNo: 'MMS2509341',
    regDate: '2025-09-14',
    name: 'MD MOHAN',
    passport: 'A00678003',
    birthDate: '2003-07-03',
    gender: 'Male',
    nationality: 'Bangladeshi',
    country: 'UAE/DUBAI',
    marital: 'Unmarried',
    religion: 'Islam',
    agency: 'MYSA MD SIR',
    weightKg: 54,
    heightCm: null,
    photoUrl: '/photo_MMS2509341.png',
    xrayUrl: '/xray_MMS2509341.png',
    status: 'FIT',
    remarks: 'NORMAL,',
    reportData: {
      eye_visual_acuity_r: '6/6',
      eye_visual_acuity_l: '6/6',
      ear_r: 'NAD',
      ear_l: 'NAD',
      blood_pressure: '120/80',
      heart: 'NAD',
      lungs: 'NAD',
      abdomen: 'NAD',
      hernia: 'ABSENT',
      varicose_veins: 'ABSENT',
      deformities: 'ABSENT',
      skin: '',
      cns: '',
      extremities: 'NAD',
      psychiatry: 'NAD',
      venereal_symptoms: 'NAD',
      exam_remarks: '',
      chest_xray: 'NORMAL',
      xray_remarks: 'NORMAL',
      urine_sugar_albumin: 'NIL - NIL',
      urine_opiates_cannabis: 'N/A - N/A - N/A',
      urine_pregnancy: 'N/A',
      blood_group: '',
      haemoglobin: '',
      esr: '',
      rbs: '6.5',
      s_creatinine: '1.0',
      s_bil: '0.85',
      sgpt: '35',
      sgot: '',
      hiv: 'NEGATIVE',
      hbsag: 'NEGATIVE',
      anti_hcv: 'NEGATIVE',
      tpha: 'NEGATIVE',
      vdrl: 'NON REACTIVE',
      lab_remarks: 'NORMAL'
    }
  },
  {
    regNo: 'MMS2509342',
    regDate: '2026-10-11',
    name: 'MD SAMIM',
    passport: 'B00857341',
    birthDate: '1987-06-01',
    gender: 'Male',
    nationality: 'BANGLADESH',
    country: 'BANGLADESH',
    marital: 'MARRIED',
    religion: 'ISLAM',
    agency: 'ORIEN OASIS',
    weightKg: 63,
    heightCm: null,
    photoUrl: '/photo_MMS2509342.png',
    xrayUrl: '/xray_MMS2509342.png',
    status: 'FIT',
    remarks: 'NORMAL,',
    reportData: {
      eye_visual_acuity_r: '5/5',
      eye_visual_acuity_l: '7/6',
      ear_r: 'NAD',
      ear_l: 'NAD',
      blood_pressure: '120/80',
      heart: 'NAD',
      lungs: 'NAD',
      abdomen: 'NAD',
      hernia: 'ABSENT',
      varicose_veins: 'ABSENT',
      deformities: 'ABSENT',
      skin: '',
      cns: '',
      extremities: 'NAD',
      psychiatry: 'NAD',
      venereal_symptoms: 'NAD',
      exam_remarks: '',
      chest_xray: 'NORMAL',
      xray_remarks: 'NORMAL',
      urine_sugar_albumin: 'NIL - NIL',
      urine_opiates_cannabis: 'N/A - N/A - N/A',
      urine_pregnancy: 'N/A',
      blood_group: '',
      haemoglobin: '',
      esr: '',
      rbs: '5.5',
      s_creatinine: '2.0',
      s_bil: '0.75',
      sgpt: '36',
      sgot: '',
      hiv: 'NEGATIVE',
      hbsag: 'NEGATIVE',
      anti_hcv: 'NEGATIVE',
      tpha: 'NEGATIVE',
      vdrl: 'NON REACTIVE',
      lab_remarks: 'NORMAL'
    }
  },
  {
    regNo: 'MMS2509343',
    regDate: '2026-10-10',
    name: 'MD ABDUR RAHIM',
    passport: 'A07109661',
    birthDate: '1985-07-18',
    gender: 'Male',
    nationality: 'BANGLADESH',
    country: 'BANGLADESH',
    marital: 'MARRIED',
    religion: 'ISLAM',
    agency: 'ORIEN OASIS',
    weightKg: 70,
    heightCm: null,
    photoUrl: '/photo_MMS2509343.png',
    xrayUrl: '/xray_MMS2509343.png',
    status: 'FIT',
    remarks: 'NORMAL,',
    reportData: {
      eye_visual_acuity_r: '7/7',
      eye_visual_acuity_l: '7/7',
      ear_r: 'NAD',
      ear_l: 'NAD',
      blood_pressure: '120/80',
      heart: 'NAD',
      lungs: 'NAD',
      abdomen: 'NAD',
      hernia: 'ABSENT',
      varicose_veins: 'ABSENT',
      deformities: 'ABSENT',
      skin: '',
      cns: '',
      extremities: 'NAD',
      psychiatry: 'NAD',
      venereal_symptoms: 'NAD',
      exam_remarks: '',
      chest_xray: 'NORMAL',
      xray_remarks: 'NORMAL',
      urine_sugar_albumin: 'NIL - NIL',
      urine_opiates_cannabis: 'N/A - N/A - N/A',
      urine_pregnancy: 'N/A',
      blood_group: '',
      haemoglobin: '',
      esr: '',
      rbs: '6.5',
      s_creatinine: '1.0',
      s_bil: '0.85',
      sgpt: '37',
      sgot: '',
      hiv: 'NEGATIVE',
      hbsag: 'NEGATIVE',
      anti_hcv: 'NEGATIVE',
      tpha: 'NEGATIVE',
      vdrl: 'NON REACTIVE',
      lab_remarks: 'NORMAL'
    }
  },
  {
    regNo: 'MMS2509344',
    regDate: '2026-10-10',
    name: 'MOHAMMAD ABU JIHAD AKASH',
    passport: 'A14557248',
    birthDate: '1998-01-01',
    gender: 'Male',
    nationality: 'BANGLADESH',
    country: 'BANGLADESH',
    marital: 'MARRIED',
    religion: 'ISLAM',
    agency: 'ORIEN OASIS',
    weightKg: 68,
    heightCm: null,
    photoUrl: '/photo_MMS2509344.png',
    xrayUrl: '/xray_MMS2509344.png',
    status: 'FIT',
    remarks: 'NORMAL,',
    reportData: {
      eye_visual_acuity_r: '8/8',
      eye_visual_acuity_l: '6/6',
      ear_r: 'NAD',
      ear_l: 'NAD',
      blood_pressure: '120/80',
      heart: 'NAD',
      lungs: 'NAD',
      abdomen: 'NAD',
      hernia: 'ABSENT',
      varicose_veins: 'ABSENT',
      deformities: 'ABSENT',
      skin: '',
      cns: '',
      extremities: 'NAD',
      psychiatry: 'NAD',
      venereal_symptoms: 'NAD',
      exam_remarks: '',
      chest_xray: 'NORMAL',
      xray_remarks: 'NORMAL',
      urine_sugar_albumin: 'NIL - NIL',
      urine_opiates_cannabis: 'N/A - N/A - N/A',
      urine_pregnancy: 'N/A',
      blood_group: '',
      haemoglobin: '',
      esr: '',
      rbs: '6.5',
      s_creatinine: '1.0',
      s_bil: '0.75',
      sgpt: '35',
      sgot: '',
      hiv: 'NEGATIVE',
      hbsag: 'NEGATIVE',
      anti_hcv: 'NEGATIVE',
      tpha: 'NEGATIVE',
      vdrl: 'NON REACTIVE',
      lab_remarks: 'NORMAL'
    }
  },
  {
    regNo: 'MMS2509345',
    regDate: '2026-10-10',
    name: 'EYASIN ARAFAT SHAKIB',
    passport: 'A02491143',
    birthDate: '2000-05-01',
    gender: 'Male',
    nationality: 'BANGLADESH',
    country: 'BANGLADESH',
    marital: 'UNMARRIED',
    religion: 'ISLAM',
    agency: 'ORIEN OASIS',
    weightKg: 65,
    heightCm: null,
    photoUrl: '/photo_MMS2509345.png',
    xrayUrl: '/xray_MMS2509345.png',
    status: 'FIT',
    remarks: 'NORMAL,',
    reportData: {
      eye_visual_acuity_r: '6/6',
      eye_visual_acuity_l: '6/6',
      ear_r: 'NAD',
      ear_l: 'NAD',
      blood_pressure: '120/80',
      heart: 'NAD',
      lungs: 'NAD',
      abdomen: 'NAD',
      hernia: 'ABSENT',
      varicose_veins: 'ABSENT',
      deformities: 'ABSENT',
      skin: '',
      cns: '',
      extremities: 'NAD',
      psychiatry: 'NAD',
      venereal_symptoms: 'NAD',
      exam_remarks: '',
      chest_xray: 'NORMAL',
      xray_remarks: 'NORMAL',
      urine_sugar_albumin: 'NIL - NIL',
      urine_opiates_cannabis: 'N/A - N/A - N/A',
      urine_pregnancy: 'N/A',
      blood_group: '',
      haemoglobin: '',
      esr: '',
      rbs: '6.5',
      s_creatinine: '1.0',
      s_bil: '0.85',
      sgpt: '34',
      sgot: '',
      hiv: 'NEGATIVE',
      hbsag: 'NEGATIVE',
      anti_hcv: 'NEGATIVE',
      tpha: 'NEGATIVE',
      vdrl: 'NON REACTIVE',
      lab_remarks: 'NORMAL'
    }
  }
];

async function seedNewEntries() {
  await client.connect();
  console.log('Connected to PostgreSQL Database.');

  try {
    await client.query('BEGIN');

    // 1. Clear all existing operational data
    console.log('Deleting all existing operational records...');
    await client.query(`
      TRUNCATE TABLE 
        medical_certificates, 
        report_verification_tokens, 
        medical_report_revisions, 
        medical_reports, 
        patients, 
        audit_logs 
      CASCADE;
    `);
    console.log('Operational tables cleared.');

    // 2. Fetch system users
    const usersRes = await client.query('SELECT id, role, email FROM users');
    const doctorUser = usersRes.rows.find(u => u.role === 'DOCTOR') || usersRes.rows[0];
    const adminUser = usersRes.rows.find(u => u.role === 'SUPER_ADMIN') || usersRes.rows[0];
    const operatorUser = usersRes.rows.find(u => u.role === 'REPORT_OPERATOR') || usersRes.rows[0];

    // 3. Fetch active template version
    const tmplVersionRes = await client.query('SELECT id FROM report_template_versions LIMIT 1');
    const templateVersionId = tmplVersionRes.rows[0]?.id;
    if (!templateVersionId) throw new Error('No template version found in database.');

    // 4. Update Organization Settings
    const settingsUpdateQuery = `
      UPDATE organization_settings SET
        "orgName" = 'MYSA Medical Center',
        "orgCode" = 'MMS',
        "orgAddress" = 'Diagnostic & Medical Checkup Centre for Overseas Employment',
        "orgPhone" = '+880 1700-000000',
        "orgEmail" = 'info@mysamedicalbd.com',
        "reportHeaderTitle" = 'MEDICAL TEST REPORT',
        "disclaimerText" = 'This is an auto generated report, does not require any signature.',
        "certificateTitle" = 'MEDICAL FITNESS CERTIFICATE',
        "certificateNumberPrefix" = 'MC',
        "signatoryName" = 'Dr. A. K. M. Shamsuddin',
        "signatoryDesignation" = 'MBBS, FCPS - Medical Director',
        "signatoryLicenseNumber" = 'BMDC Reg No: A-12345',
        "certificateValidityDays" = 90,
        "publicDisclosure" = $1,
        "certificateFields" = $2,
        "updatedAt" = now()
    `;
    const publicDisclosure = {
      showDob: true,
      showPassport: true,
      maskPassport: false,
      patientNameMode: 'FULL',
      showDestination: true,
      showNationality: true,
      allowPublicPrint: true,
      showDetailedReport: true,
      allowPublicDownload: true,
      allowedReportSections: ['physical', 'systemic', 'lab', 'xray']
    };
    const certificateFields = {
      showDob: true,
      showPassport: true,
      showDestination: true,
      showNationality: true,
      showDoctorDetails: true
    };
    await client.query(settingsUpdateQuery, [JSON.stringify(publicDisclosure), JSON.stringify(certificateFields)]);
    console.log('Organization settings verified & configured.');

    // 5. Insert entries
    let certSeq = 1;

    for (const e of entries) {
      const patientId = uuidv4();
      const reportId = uuidv4();
      const revisionId = uuidv4();
      const certId = uuidv4();
      const tokenId = uuidv4();

      const certNumber = `MC-2026-${String(certSeq).padStart(5, '0')}`;
      certSeq++;

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

      const reportToken = crypto.randomBytes(32).toString('hex');
      const reportTokenHash = crypto.createHash('sha256').update(reportToken).digest('hex');

      const registeredAt = e.regDate;
      const createdAt = new Date(`${e.regDate}T10:00:00.000Z`);
      const issuedAt = createdAt;
      const expiresAt = new Date(createdAt.getTime() + 90 * 86400000);

      // A. Patient
      await client.query(`
        INSERT INTO patients (
          id, "fullName", "passportNumber", "dateOfBirth", gender,
          nationality, country, "maritalStatus", religion, "heightCm",
          "weightKg", agency, "photoUrl", "fingerprintUrl", "isArchived",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17
        )
      `, [
        patientId, e.name, e.passport, e.birthDate, e.gender,
        e.nationality, e.country, e.marital, e.religion, e.heightCm,
        e.weightKg, e.agency, e.photoUrl, null, false,
        createdAt, createdAt
      ]);

      // B. Medical Report
      await client.query(`
        INSERT INTO medical_reports (
          id, "registrationNumber", "patientId", "templateVersionId",
          status, "registeredAt", "reportData", "finalMedicalStatus",
          "finalRemarks", "finalizedById", "finalizedAt", "currentRevisionNumber",
          "xrayImageUrl", "xrayFinding", "xrayRemarks", "createdById",
          "updatedById", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19
        )
      `, [
        reportId, e.regNo, patientId, templateVersionId,
        'FINALIZED', registeredAt, JSON.stringify(e.reportData), 'FIT',
        e.remarks, doctorUser.id, createdAt, 1,
        e.xrayUrl, 'NORMAL', 'NORMAL', operatorUser.id,
        adminUser.id, createdAt, createdAt
      ]);

      // C. Report Revision
      await client.query(`
        INSERT INTO medical_report_revisions (
          id, "reportId", "revisionNumber", status, "finalMedicalStatus",
          "reportDataSnapshot", "patientDataSnapshot", "reasonForChange",
          "changedById", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10
        )
      `, [
        revisionId, reportId, 1, 'FINALIZED', 'FIT',
        JSON.stringify(e.reportData),
        JSON.stringify({
          fullName: e.name,
          passportNumber: e.passport,
          dateOfBirth: e.birthDate,
          gender: e.gender,
          nationality: e.nationality,
          country: e.country,
          maritalStatus: e.marital,
          religion: e.religion,
          agency: e.agency,
          weightKg: e.weightKg,
          heightCm: e.heightCm,
          photoUrl: e.photoUrl
        }),
        'Original Verified Clinical Record Finalization',
        doctorUser.id, createdAt
      ]);

      // D. Report Verification Token (for QR scanning)
      await client.query(`
        INSERT INTO report_verification_tokens (
          id, "reportId", token, "tokenHash", "isRevoked", "createdAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
      `, [
        tokenId, reportId, reportToken, reportTokenHash, false, createdAt
      ]);

      // E. Medical Certificate Snapshot
      const certSnapshot = {
        certificateNumber: certNumber,
        registrationNumber: e.regNo,
        registeredAt: e.regDate,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        finalMedicalStatus: 'FIT',
        finalRemarks: e.remarks,
        patient: {
          id: patientId,
          fullName: e.name,
          passportNumber: e.passport,
          dateOfBirth: e.birthDate,
          gender: e.gender,
          nationality: e.nationality,
          country: e.country,
          agency: e.agency,
          photoUrl: e.photoUrl
        },
        organization: {
          orgName: 'MYSA Medical Center',
          orgCode: 'MMS',
          orgAddress: 'Diagnostic & Medical Checkup Centre for Overseas Employment',
          orgPhone: '+880 1700-000000',
          orgEmail: 'info@mysamedicalbd.com',
          certificateTitle: 'MEDICAL FITNESS CERTIFICATE',
          signatoryName: 'Dr. A. K. M. Shamsuddin',
          signatoryDesignation: 'MBBS, FCPS - Medical Director',
          signatoryLicenseNumber: 'BMDC Reg No: A-12345'
        },
        xrayFinding: 'NORMAL',
        xrayRemarks: 'NORMAL',
        xrayImageUrl: e.xrayUrl,
        revisionNumber: 1
      };

      // Certificate
      await client.query(`
        INSERT INTO medical_certificates (
          id, "certificateNumber", "reportId", "reportRevisionId",
          "patientId", "verificationToken", "verificationTokenHash",
          status, "issuedAt", "expiresAt", "issuedById",
          "approvedDisclosurePolicyVersion", "certificateDataSnapshot",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13,
          $14, $15
        )
      `, [
        certId, certNumber, reportId, revisionId,
        patientId, verificationToken, verificationTokenHash,
        'ACTIVE', issuedAt, expiresAt, doctorUser.id,
        1, JSON.stringify(certSnapshot),
        createdAt, createdAt
      ]);

      console.log(`Inserted candidate: ${e.name} (${e.regNo}) -> Cert: ${certNumber}`);
      console.log(`   Verification URL: https://medverify-zeta.vercel.app/verify/${verificationToken}`);
    }

    await client.query('COMMIT');
    console.log('ALL 5 ENTRIES SUCCESSFULLY SAVED TO DATABASE!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during seeding, transaction rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seedNewEntries().catch(console.error);
