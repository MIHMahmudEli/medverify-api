import { DataSource } from 'typeorm';

export async function ensureSchema(dataSource: DataSource) {
  try {
    // 1. Create medical_certificates table if it doesn't exist
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS medical_certificates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "certificateNumber" varchar(64) UNIQUE NOT NULL,
        "reportId" uuid NOT NULL,
        "reportRevisionId" uuid,
        "patientId" uuid NOT NULL,
        "verificationToken" varchar(128) UNIQUE NOT NULL,
        "verificationTokenHash" varchar(128),
        status varchar(32) DEFAULT 'ACTIVE',
        "issuedAt" timestamptz NOT NULL,
        "expiresAt" timestamptz,
        "revokedAt" timestamptz,
        "revokedById" uuid,
        "revocationReason" text,
        "issuedById" uuid NOT NULL,
        "approvedDisclosurePolicyVersion" integer DEFAULT 1,
        "certificateDataSnapshot" jsonb DEFAULT '{}'::jsonb,
        "pdfArtifactReference" text,
        "createdAt" timestamptz DEFAULT now(),
        "updatedAt" timestamptz DEFAULT now()
      );
    `);

    // 2. Add columns to organization_settings if they don't exist
    await dataSource.query(`
      ALTER TABLE organization_settings
      ADD COLUMN IF NOT EXISTS "certificateTitle" varchar(255) DEFAULT 'MEDICAL FITNESS CERTIFICATE',
      ADD COLUMN IF NOT EXISTS "certificateNumberPrefix" varchar(50) DEFAULT 'MC',
      ADD COLUMN IF NOT EXISTS "signatoryName" varchar(255) DEFAULT 'Dr. A. K. M. Shamsuddin',
      ADD COLUMN IF NOT EXISTS "signatoryDesignation" varchar(255) DEFAULT 'MBBS, FCPS - Medical Director',
      ADD COLUMN IF NOT EXISTS "signatoryLicenseNumber" varchar(100) DEFAULT 'BMDC Reg No: A-12345',
      ADD COLUMN IF NOT EXISTS "signatorySignatureUrl" text,
      ADD COLUMN IF NOT EXISTS "certificateFooter" text DEFAULT 'This official certificate verifies fitness for overseas employment. Authenticate online using the security QR code.',
      ADD COLUMN IF NOT EXISTS "certificateValidityDays" integer DEFAULT 90,
      ADD COLUMN IF NOT EXISTS "certificateFields" jsonb DEFAULT '{"showPassport": true, "showDob": true, "showNationality": true, "showDestination": true, "showDoctorDetails": true}'::jsonb,
      ADD COLUMN IF NOT EXISTS "publicDisclosure" jsonb DEFAULT '{"patientNameMode": "INITIALS", "showPassport": false, "showDob": false, "showNationality": true, "showDestination": true, "showDetailedReport": false, "allowedReportSections": ["physical", "systemic", "lab", "xray"], "allowPublicDownload": true, "allowPublicPrint": true}'::jsonb;
    `);

    // 3. Create indices on medical_certificates
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_reportId" ON medical_certificates ("reportId");
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_patientId" ON medical_certificates ("patientId");
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_status" ON medical_certificates (status);
    `);

    console.log('[Schema] Medical certificates and organization settings tables verified.');
  } catch (err: any) {
    console.warn('[Schema] Notice during schema ensure:', err?.message || err);
  }
}
