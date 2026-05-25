# MediFlow Frontend

Next.js 14 dashboard for MediFlow Hospital Management System.

**Backend repo:** [mediflow-backend](https://github.com/YOUR_ORG/mediflow-backend)

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — point NEXT_PUBLIC_* URLs at your local backend services

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

### One-click deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual steps
1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import the `mediflow-frontend` repo
3. Framework: **Next.js** (auto-detected)
4. Set environment variables in Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://mediflow-iam-service.onrender.com` |
| `NEXT_PUBLIC_PATIENT_API_URL` | `https://mediflow-patient-service.onrender.com` |
| `NEXT_PUBLIC_APPOINTMENT_API_URL` | `https://mediflow-appointment-service.onrender.com` |
| `NEXT_PUBLIC_BILLING_API_URL` | `https://mediflow-billing-service.onrender.com` |
| `NEXTAUTH_SECRET` | _(run: `openssl rand -base64 32`)_ |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |

5. Click **Deploy**

> **CORS**: After deploying, add your Vercel URL to the CORS allowlist in the backend services' environment variables (`FRONTEND_URL=https://your-app.vercel.app`).

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth.js (JWT)
- **State**: Zustand + TanStack Query
- **UI**: Tailwind CSS + Radix UI
- **Charts**: Recharts

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@greenvalley.com | Admin@123 |
| Doctor | dr.patel@greenvalley.com | Doctor@1234 |
| Receptionist | reception@greenvalley.com | Reception@1234 |
| Pharmacist | pharmacist@greenvalley.com | Pharma@1234 |
| Lab Tech | lab@greenvalley.com | Lab@1234 |
| Nurse | nurse@greenvalley.com | Nurse@1234 |
