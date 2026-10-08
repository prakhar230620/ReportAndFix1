# 🛡️ ReportAndFix

> **Scan. Report. Fix.**  
> Next-generation multi-tenant SaaS issue tracking and resolution platform for campuses, institutions, and enterprises.

---

## 🌐 Live Production Deployment
- **Production URL:** [https://reportandfix-nine.vercel.app](https://reportandfix-nine.vercel.app)
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database & Auth:** Supabase (PostgreSQL + RLS + pg_cron)
- **Billing & Subscriptions:** Razorpay Payments (UPI, Cards, NetBanking) + Dynamic Tier Invoicing
- **Mobile/Offline:** Progressive Web App (PWA) with Service Worker

---

## 📋 Table of Contents
1. [Key Features](#-key-features)
2. [Database Setup & Migrations (Supabase)](#-database-setup--migrations-supabase)
3. [Progressive Web App (PWA) Setup](#-progressive-web-app-pwa-setup)
4. [Razorpay Payment Gateway Integration](#-razorpay-payment-gateway-integration)
   - [Why "Invalid UPI ID" happens in Sandbox](#why-invalid-upi-id-happens-in-sandbox)
   - [Step-by-Step Production Live Mode Setup](#step-by-step-production-live-mode-setup)
5. [Supabase Auth & URL Configuration](#-supabase-auth--url-configuration)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [Local Development](#-local-development)

---

## ✨ Key Features
- **Multi-Tenant Architecture:** Isolated organizations/colleges with tier-based quotas.
- **Dynamic 4-Tier Subscription Plans:** Starter, Standard, Pro, Enterprise with custom quotas (workers, monthly complaints, storage limit).
- **Automated Freeze & Lockdown:** Inactive or expired subscriptions automatically freeze administrative and reporting actions until renewed.
- **Automated Daily Expiry Checks:** `pg_cron` calls the secure webhook endpoint `/api/cron` daily to check for expiring and frozen organizations.
- **Dual-Engine Notification Mailer:** Dual fallback supporting modern Resend API and standard SMTP.
- **Full PWA Support:** Installable on mobile & desktop, offline fallback screen, and static asset caching.
- **Automated PDF Invoices:** On-demand cryptographic PDF invoice generation for completed transactions.

---

## 🗄️ Database Setup & Migrations (Supabase)

Run the following SQL snippet in your **[Supabase SQL Editor](https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql)**:

```sql
-- 1. ADD 'staff_message' TO plan_notification_type ENUM
DO $$ BEGIN
  ALTER TYPE plan_notification_type ADD VALUE IF NOT EXISTS 'staff_message';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. ENSURE UNIQUE CONSTRAINT ON org_subscriptions (college_id)
DO $$ BEGIN
  ALTER TABLE org_subscriptions ADD CONSTRAINT org_subscriptions_college_id_key UNIQUE (college_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- 3. ENABLE EXTENSIONS FOR AUTOMATED CRON
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. REGISTER PG_CRON SCHEDULE (Daily at 01:00 UTC = 06:30 IST)
SELECT cron.schedule(
  'reportandfix-check-plan-expiry',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://reportandfix-nine.vercel.app/api/cron',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "Qtr4UqmrTklx5PF3O2GRa0PfBqBmYcerbIVNyJsBlZ8vjwnB3cqFzajhBU4lWIMl"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## 📱 Progressive Web App (PWA) Setup

ReportAndFix is fully installable as an app on Android, iOS, Windows, and macOS:

1. **Manifest File (`app/manifest.ts`):** Defines standalone presentation, theme colors (`#2563eb`), background (`#09090b`), and high-res vector icons.
2. **Service Worker (`public/sw.js`):**
   - Automatically pre-caches core static assets and routes.
   - Intercepts network failures during offline mode and serves the `/offline` fallback page.
   - Employs stale-while-revalidate strategy for assets to ensure sub-second loads.
3. **App Install Banner (`app/components/PwaRegister.tsx`):**
   - Detects the browser's `beforeinstallprompt` event and presents a clean installation banner to users when browsing in standard browser tabs.
4. **App Icons (`public/icons/`):**
   - Vector shield brand icon (`icon.svg`).
   - 192x192 & 512x512 maskable PNG icons.
   - Apple Touch Icon (180x180).

---

## 💳 Razorpay Payment Gateway Integration

### Why "Invalid UPI ID" happens in Sandbox
When testing payments using Razorpay **Test Mode (`rzp_test_...`)**:
- Razorpay Sandbox is disconnected from real UPI NPCI banking servers.
- **Entering a real personal UPI ID (e.g. `user@oksbi`, `phone@paytm`, `name@ybl`) will always produce an `Invalid UPI ID` error.**
- **How to test in Sandbox:** Use Razorpay's designated test handles:
  - UPI ID: `success@razorpay` (Simulates a successful payment)
  - Or click the **Cards** or **NetBanking** test simulator in the checkout popup.

---

### Step-by-Step Production Live Mode Setup

To accept **actual money from real users** via UPI, Google Pay, PhonePe, Paytm, QR Codes, and Cards:

#### 1. Activate Account & KYC
1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Submit business / personal KYC (PAN, Bank Account for settlements, Aadhaar/Business registration).
3. Once approved, switch the dashboard toggle from **"Test Mode"** to **"Live Mode"**.

#### 2. Generate Live API Keys
1. Go to **Account & Settings** ➔ **API Keys**.
2. Click **Generate Live Key**.
3. Copy both:
   - **Key ID:** `rzp_live_xxxxxxxxxxxxxxxx`
   - **Key Secret:** `xxxxxxxxxxxxxxxxxxxxxxxx`

#### 3. Update Vercel Environment Variables
In your [Vercel Project Dashboard](https://vercel.com/):
1. Navigate to **Settings** ➔ **Environment Variables**.
2. Set:
   - `RAZORPAY_KEY_ID`: `rzp_live_...`
   - `RAZORPAY_KEY_SECRET`: Live Secret
   - `NEXT_PUBLIC_APP_URL`: `https://reportandfix-nine.vercel.app`
3. Trigger a redeploy to apply the keys.

#### 4. Configure Live Webhook
1. In Razorpay Dashboard, go to **Account & Settings** ➔ **Webhooks**.
2. Click **Add New Webhook**:
   - **Webhook URL:** `https://reportandfix-nine.vercel.app/api/payments/webhook`
   - **Secret:** Enter a custom secret string (and set this as `RAZORPAY_WEBHOOK_SECRET` in Vercel).
   - **Active Events:**
     - `payment.captured`
     - `order.paid`
3. Save the webhook.

---

## 🔐 Supabase Auth & URL Configuration

To ensure OAuth and email magic link logins work smoothly in production:
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj).
2. Go to **Authentication** ➔ **URL Configuration**.
3. Set **Site URL** to:
   ```
   https://reportandfix-nine.vercel.app
   ```
4. In **Redirect URLs**, add:
   ```
   https://reportandfix-nine.vercel.app/**
   http://localhost:3000/**
   ```

---

## 🔑 Environment Variables Reference

Create a `.env.local` for local development or configure these in Vercel:

```env
# App URL
NEXT_PUBLIC_APP_URL=https://reportandfix-nine.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://qhrghanmrbxsznajlzhj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Razorpay
RAZORPAY_KEY_ID=rzp_test_or_live_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Cron Job Secret
CRON_SECRET=Qtr4UqmrTklx5PF3O2GRa0PfBqBmYcerbIVNyJsBlZ8vjwnB3cqFzajhBU4lWIMl

# Email (Resend or SMTP)
RESEND_API_KEY=re_your_api_key
# or SMTP:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
```

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run check

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the application locally.

---

## 🚀 Recent System Improvements & Bug Fixes

1. **Dynamic Complaint Priority Engine:**
   - Auto-calculates complaint urgency based on verified community joins scaled against institutional population (`low`, `medium`, `high`, `urgent`).
   - Automatically promotes critical community issues to top of administrative and worker queues.

2. **AI-Generated Image & Tamper Detection:**
   - Automated digital forensics pipeline scanning EXIF metadata, Latin-1 binary headers, and PNG `tEXtparameters` for synthetic AI generation (Midjourney, DALL-E, Stable Diffusion).
   - Rejects manipulated or synthetic proof submissions during manual plan assignment.

3. **Configurable Camera & Verification Policies:**
   - Supports institutions with strict mobile phone camera bans via `camera_mode`: `both`, `camera_only`, or `manual_only`.
   - When set to `manual_only`, field staff can complete tasks with descriptive text notes and citizens can report via manual location search without requiring live camera access.

4. **Super Admin Plan Management & Lifecycle Controls:**
   - Enables Super Admins to manually assign, suspend, reactivate, or cancel subscriptions.
   - Enforces online payment records (UPI, NetBanking, Cards/RuPay) and strictly prohibits untracked cash transactions.

5. **Live Quota Analytics & Dashboard Enhancements:**
   - Real-time quota utilization breakdown in Super Admin analytics (Monthly complaints, storage footprint, and worker seats).
   - WhatsApp-style unread notification dots on active complaints that clear upon inspection.
   - High-contrast, color-coded status and priority tags across all dashboards.
   - Performance-optimized 3D Hero canvas utilizing `IntersectionObserver` to eliminate scroll lag and render crashes.
