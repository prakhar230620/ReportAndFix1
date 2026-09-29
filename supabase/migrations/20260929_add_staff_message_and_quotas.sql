-- ReportAndFix Migration: staff_message Enum, Subscription Unique Constraint, & pg_cron Setup
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

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
-- Replace the URL with your live domain or test endpoint as needed
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
