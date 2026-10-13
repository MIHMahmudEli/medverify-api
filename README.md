# MedVerify API

Enterprise NestJS REST backend for the **MedVerify** medical examination reporting, clinical decision-making, and cryptographic QR verification platform.

## Architecture & Technology Stack

- **Framework**: NestJS (v10) with Express
- **Database**: PostgreSQL (Supabase) via TypeORM
- **Authentication**: JWT & HTTP-only cookies with Argon2 password hashing
- **Authorization**: Role-Based Access Control (`SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `LAB_TECHNICIAN`, `REPORT_OPERATOR`, `VIEWER`)
- **PDF Generation**: Server-rendered A4 clinical test reports using `pdfkit`
- **Verification**: High-entropy cryptographic QR tokens with minimal public data exposure
- **Rate Limiting**: `@nestjs/throttler` (120 req/min)
- **Security**: Helmet, strict DTO validation (`class-validator`), uniform error filters
- **API Documentation**: OpenAPI / Swagger at `/api/docs`

## Environment Variables

Copy `.env.example` to `.env` or set the following environment variables:

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | API server listening port | `4000` |
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@host:5432/db` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `API_BASE_URL` | Public API base URL | `http://localhost:4000` |
| `AUTH_SECRET` | 32+ character secret for JWT signing | Strong random string |
| `QR_VERIFICATION_BASE_URL` | Base URL encoded in QR codes | `http://localhost:3000/verify` |
| `SUPABASE_URL` | Optional Supabase project URL | `https://example.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase Service Key | Key string |

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Schema & Seed Data
```bash
npm run seed
```
This initializes the database schema, default template, and creates seed accounts:
- `admin@medverify.com` / `AdminPassword123!` (Role: `SUPER_ADMIN`)
- `doctor@medverify.com` / `DoctorPassword123!` (Role: `DOCTOR`)
- `operator@medverify.com` / `OperatorPassword123!` (Role: `REPORT_OPERATOR`)
- `lab@medverify.com` / `LabPassword123!` (Role: `LAB_TECHNICIAN`)

### 3. Run Development Server
```bash
npm run start:dev
```

### 4. Build for Production
```bash
npm run build
npm run start:prod
```

### 5. Run Unit & Integration Tests
```bash
npm test
```

## REST Endpoints Overview

All REST endpoints are prefixed under `/api/v1`:

- `POST /api/v1/auth/login` — User authentication and JWT issuance
- `POST /api/v1/auth/logout` — Invalidate session cookie
- `GET /api/v1/auth/me` — Authenticated user profile
- `GET /api/v1/patients` — List patients with search and pagination
- `POST /api/v1/patients` — Register new patient
- `GET /api/v1/reports` — List medical reports with status filters
- `POST /api/v1/reports` — Create examination report draft
- `POST /api/v1/reports/:id/submit` — Submit report for doctor review
- `POST /api/v1/reports/:id/finalize` — Doctor finalization and QR issuance
- `POST /api/v1/reports/:id/amend` — Doctor amendment creating new revision
- `POST /api/v1/reports/:id/revoke` — Administrator certificate revocation
- `GET /api/v1/reports/:id/pdf` — Stream server-side rendered clinical PDF
- `GET /api/v1/public/verify/:token` — Read-only public QR verification endpoint
- `GET /api/v1/dashboard/metrics` — Live operational metrics
- `GET /api/docs` — Interactive Swagger documentation
