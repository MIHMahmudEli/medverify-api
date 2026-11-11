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
      ADD COLUMN IF NOT EXISTS "orgAddressLine2" text,
      ADD COLUMN IF NOT EXISTS "certificateTitle" varchar(255) DEFAULT 'MEDICAL FITNESS CERTIFICATE',
      ADD COLUMN IF NOT EXISTS "certificateNumberPrefix" varchar(50) DEFAULT 'MC',
      ADD COLUMN IF NOT EXISTS "signatoryName" varchar(255) DEFAULT 'Dr. A. K. M. Shamsuddin',
      ADD COLUMN IF NOT EXISTS "signatoryDesignation" varchar(255) DEFAULT 'MBBS, FCPS - Medical Director',
      ADD COLUMN IF NOT EXISTS "signatoryLicenseNumber" varchar(100) DEFAULT 'BMDC Reg No: A-12345',
      ADD COLUMN IF NOT EXISTS "signatorySignatureUrl" text,
      ADD COLUMN IF NOT EXISTS "certificateFooter" text DEFAULT 'This official certificate verifies fitness for overseas employment. Authenticate online using the security QR code.',
      ADD COLUMN IF NOT EXISTS "certificateValidityDays" integer DEFAULT 90,
      ADD COLUMN IF NOT EXISTS "certificateFields" jsonb DEFAULT '{"showPassport": true, "showDob": true, "showNationality": true, "showDestination": true, "showDoctorDetails": true}'::jsonb,
      ADD COLUMN IF NOT EXISTS "publicDisclosure" jsonb DEFAULT '{"patientNameMode": "INITIALS", "showPassport": false, "showDob": false, "showNationality": true, "showDestination": true, "showDetailedReport": false, "allowedReportSections": ["physical", "systemic", "lab", "xray"], "allowPublicDownload": true, "allowPublicPrint": true}'::jsonb,
      ADD COLUMN IF NOT EXISTS "isDefault" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now();
    `);

    // Ensure at least one organization has isDefault = true
    await dataSource.query(`
      UPDATE organization_settings
      SET "isDefault" = true
      WHERE id = (SELECT id FROM organization_settings ORDER BY "createdAt" ASC, "updatedAt" ASC LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM organization_settings WHERE "isDefault" = true);
    `).catch(() => {});

    // 3. Add organizationId to medical_reports and associate existing reports
    await dataSource.query(`
      ALTER TABLE medical_reports
      ADD COLUMN IF NOT EXISTS "organizationId" uuid;
      CREATE INDEX IF NOT EXISTS "IDX_med_reports_organizationId" ON medical_reports ("organizationId");
      UPDATE medical_reports
      SET "organizationId" = (SELECT id FROM organization_settings WHERE "isDefault" = true LIMIT 1)
      WHERE "organizationId" IS NULL;
    `).catch(() => {});

    // Clean up any legacy static banner fallbacks from database
    await dataSource.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE organization_settings ALTER COLUMN "orgAddressLine2" DROP DEFAULT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END $$;
      UPDATE organization_settings SET "orgAddressLine2" = NULL WHERE "orgAddressLine2" = 'VIP Road, Dhaka-1000';
      UPDATE organization_settings SET "orgName" = 'MYSA Medical Center' WHERE "orgName" = 'MYSA MEDICAL SERVICES (PVT.) LTD.';
    `).catch(() => {});

    // 4. Create indices on medical_certificates
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_reportId" ON medical_certificates ("reportId");
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_patientId" ON medical_certificates ("patientId");
      CREATE INDEX IF NOT EXISTS "IDX_med_cert_status" ON medical_certificates (status);
    `);

    console.log('[Schema] Medical certificates and multi-organization tables verified.');
  } catch (err: any) {
    console.warn('[Schema] Notice during schema ensure:', err?.message || err);
  }
}
