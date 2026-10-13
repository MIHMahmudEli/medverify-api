import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  frontendUrl: string;
  apiBaseUrl: string;
  authSecret: string;
  qrVerificationBaseUrl: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
}

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return process.env.DATABASE_URL.trim();
  }

  // Check current dir .env
  const localEnvPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(localEnvPath)) {
    const content = fs.readFileSync(localEnvPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.substring('DATABASE_URL='.length).trim();
      }
      if (trimmed.startsWith('postgresql://')) {
        return trimmed;
      }
    }
  }

  // Check parent directory .env (root workspace)
  const rootEnvPath = path.resolve(process.cwd(), '..', '.env');
  if (fs.existsSync(rootEnvPath)) {
    const content = fs.readFileSync(rootEnvPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.substring('DATABASE_URL='.length).trim();
      }
      if (trimmed.startsWith('postgresql://')) {
        return trimmed;
      }
    }
  }

  return '';
}

export default (): AppConfig => {
  const databaseUrl = resolveDatabaseUrl();
  const isProd = process.env.NODE_ENV === 'production';
  const defaultFrontend = isProd ? 'https://medverify-zeta.vercel.app' : 'http://localhost:3000';
  const frontendUrl = (process.env.FRONTEND_URL || defaultFrontend).replace(/\/+$/, '');
  const qrVerificationBaseUrl = (
    process.env.QR_VERIFICATION_BASE_URL || `${frontendUrl}/verify`
  ).replace(/\/+$/, '');

  return {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl,
    frontendUrl,
    apiBaseUrl: process.env.API_BASE_URL || (isProd ? 'https://medverify-api-y6am.onrender.com' : 'http://localhost:4000'),
    authSecret: process.env.AUTH_SECRET || 'medverify-super-secure-production-ready-jwt-secret-key-32chars',
    qrVerificationBaseUrl,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
};
