const { Client } = require('./node_modules/pg');
require('./node_modules/dotenv').config({ path: './.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const tables = ['patients', 'medical_reports', 'medical_certificates', 'medical_report_revisions', 'report_verification_tokens'];
  for (const t of tables) {
    const res = await client.query('SELECT count(*) FROM ' + t);
    console.log(t, 'count:', res.rows[0].count);
  }
  const certs = await client.query(`
    SELECT 
      c."certificateNumber", 
      r."registrationNumber", 
      p."fullName", 
      p."passportNumber", 
      p."photoUrl", 
      r."xrayImageUrl",
      c."verificationToken"
    FROM medical_certificates c 
    JOIN medical_reports r ON c."reportId" = r.id 
    JOIN patients p ON c."patientId" = p.id 
    ORDER BY r."registrationNumber"
  `);
  console.log('\n--- ACTIVE MEDICAL CERTIFICATES & REPORTS IN DATABASE ---');
  console.table(certs.rows);
  await client.end();
}
run().catch(console.error);
