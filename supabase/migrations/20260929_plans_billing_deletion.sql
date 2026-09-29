-- ReportAndFix Platform: Plans, Billing, Deletion, Join Codes
-- Run this in Supabase SQL editor

-- 1. PLANS
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly_paise int NOT NULL DEFAULT 0,
  price_yearly_paise  int NOT NULL DEFAULT 0,
  max_storage_gb      int NOT NULL DEFAULT 1,
  max_complaints_per_month int NOT NULL DEFAULT 50,
  max_workers         int NOT NULL DEFAULT 5,
  max_departments     int NOT NULL DEFAULT 2,
  max_admins          int NOT NULL DEFAULT 1,
  data_download_free  bool NOT NULL DEFAULT false,
  messaging_enabled   bool NOT NULL DEFAULT false,
  message_retention_hours int NOT NULL DEFAULT 24,
  features            jsonb NOT NULL DEFAULT '[]',
  is_active           bool NOT NULL DEFAULT true,
  sort_order          int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans (name, slug, description, price_monthly_paise, price_yearly_paise,
  max_storage_gb, max_complaints_per_month, max_workers, max_departments, max_admins,
  data_download_free, messaging_enabled, message_retention_hours, features, sort_order)
VALUES
  ('Starter',     'starter',      'For small organisations getting started',       49900,   499000,  2,   100,  10,  3,  1, false, false, 24,  '["Basic complaint queue","Worker assignment","QR code check-in","Email notifications"]', 1),
  ('Standard',    'standard',     'For growing institutions',                     149900,  1499000, 10,  500,  50,  10, 2, false, true,  24,  '["Everything in Starter","Departmental analytics","In-app messaging","Priority support"]', 2),
  ('Professional','professional', 'For large organisations with complex workflows',349900, 3499000, 50, 2000, 200, 30, 5, true,  true,  72,  '["Everything in Standard","Free data export","Extended message history","Dedicated support"]', 3),
  ('Enterprise',  'enterprise',   'Unlimited for enterprise deployments',          999900, 9999000,200,  -1,  -1, -1,-1, true,  true, 168,  '["Everything in Professional","Unlimited workers","SLA guarantee","White-label","API access"]', 4)
ON CONFLICT (slug) DO NOTHING;

-- 2. SUBSCRIPTION STATUS ENUM
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial','active','grace','expired','frozen','cancelled','manually_assigned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. ORG SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL REFERENCES plans(id),
  status     subscription_status NOT NULL DEFAULT 'trial',
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at        timestamptz,
  razorpay_subscription_id text,
  razorpay_customer_id     text,
  auto_renew  bool NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES profiles(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. PAYMENT STATUS ENUMS
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('created','paid','failed','refunded','partially_refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('upi','card','netbanking','qr','wallet','unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES org_subscriptions(id),
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  amount_paise    int NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'created',
  payment_method  payment_method_type NOT NULL DEFAULT 'unknown',
  description     text,
  invoice_number  text,
  refund_id       text,
  refund_amount_paise int,
  refund_status   text,
  refund_reason   text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 6. DATA DELETION REQUESTS
DO $$ BEGIN
  CREATE TYPE deletion_request_status AS ENUM ('pending_approvals','pending_download','download_ready','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES profiles(id),
  status          deletion_request_status NOT NULL DEFAULT 'pending_approvals',
  approvals_required int NOT NULL DEFAULT 1,
  approvals_received jsonb NOT NULL DEFAULT '{}',
  complaint_ids   uuid[] NOT NULL DEFAULT '{}',
  complaint_count int NOT NULL DEFAULT 0,
  download_token  uuid UNIQUE DEFAULT gen_random_uuid(),
  download_expires_at timestamptz,
  download_confirmed  bool NOT NULL DEFAULT false,
  download_size_bytes bigint,
  download_charge_paise int NOT NULL DEFAULT 0,
  charge_paid     bool NOT NULL DEFAULT false,
  charge_payment_id text,
  backup_b2_path  text,
  pdf_list_b2_path text,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 7. ORG JOIN CODES
CREATE TABLE IF NOT EXISTS org_join_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  code       text NOT NULL,
  qr_token   text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active  bool NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_codes_college ON org_join_codes(college_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_join_codes_qr ON org_join_codes(qr_token);

-- 8. PLAN NOTIFICATIONS
DO $$ BEGIN
  CREATE TYPE plan_notification_type AS ENUM (
    'expiry_warning_15d','expiry_warning_7d','expiry_warning_3d','expiry_warning_1d',
    'plan_expired','payment_failed','payment_success','plan_assigned','refund_processed',
    'soft_delete_warning','terms_updated'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS plan_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id  uuid REFERENCES colleges(id) ON DELETE CASCADE,
  profile_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type        plan_notification_type NOT NULL,
  title       text NOT NULL,
  body        text,
  is_read     bool NOT NULL DEFAULT false,
  email_sent  bool NOT NULL DEFAULT false,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_notif_profile ON plan_notifications(profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_plan_notif_college ON plan_notifications(college_id, created_at DESC);

-- 9. TERMS & CONDITIONS
CREATE TABLE IF NOT EXISTS terms_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version    text NOT NULL UNIQUE,
  content    text NOT NULL,
  is_current bool NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terms_acceptances (
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  terms_id    uuid NOT NULL REFERENCES terms_versions(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, terms_id)
);

-- 10. IN-APP MESSAGING
CREATE TABLE IF NOT EXISTS messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES profiles(id),
  body         text NOT NULL,
  complaint_id uuid REFERENCES complaints(id) ON DELETE SET NULL,
  tagged_user_ids uuid[] DEFAULT '{}',
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_college ON messages(college_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;

-- 11. CONTACT FORM SUBMISSIONS
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  subject    text NOT NULL,
  message    text NOT NULL,
  status     text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','replied')),
  reply      text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. ALTER EXISTING TABLES
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by           uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS deletion_request_id  uuid REFERENCES data_deletion_requests(id);

ALTER TABLE colleges
  ADD COLUMN IF NOT EXISTS is_frozen         bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason     text,
  ADD COLUMN IF NOT EXISTS frozen_at         timestamptz,
  ADD COLUMN IF NOT EXISTS join_code_required bool NOT NULL DEFAULT true;

-- 13. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_plans_updated ON plans;
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subs_updated ON org_subscriptions;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON org_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_txn_updated ON payment_transactions;
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_del_updated ON data_deletion_requests;
CREATE TRIGGER trg_del_updated BEFORE UPDATE ON data_deletion_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans readable by all" ON plans;
CREATE POLICY "Plans readable by all" ON plans FOR SELECT TO authenticated USING (is_active = true);

ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sub readable by org" ON org_subscriptions;
CREATE POLICY "Sub readable by org" ON org_subscriptions FOR SELECT TO authenticated
  USING (college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Transactions by admins" ON payment_transactions;
CREATE POLICY "Transactions by admins" ON payment_transactions FOR SELECT TO authenticated
  USING (college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid() AND role IN ('college_admin','super_admin')));

ALTER TABLE plan_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifs by recipient" ON plan_notifications;
CREATE POLICY "Notifs by recipient" ON plan_notifications FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid() AND role IN ('college_admin','super_admin')));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages by org staff" ON messages;
CREATE POLICY "Messages by org staff" ON messages FOR SELECT TO authenticated
  USING (college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid() AND role IN ('college_admin','dept_admin','worker'))
    AND (expires_at IS NULL OR expires_at > now()));

ALTER TABLE terms_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Terms readable by all" ON terms_versions;
CREATE POLICY "Terms readable by all" ON terms_versions FOR SELECT TO authenticated USING (true);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Contact by super admin" ON contact_submissions;
CREATE POLICY "Contact by super admin" ON contact_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deletion requests by org admin" ON data_deletion_requests;
CREATE POLICY "Deletion requests by org admin" ON data_deletion_requests FOR ALL TO authenticated
  USING (college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid() AND role IN ('college_admin','super_admin')));

ALTER TABLE org_join_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Join codes by org admin" ON org_join_codes;
CREATE POLICY "Join codes by org admin" ON org_join_codes FOR ALL TO authenticated
  USING (college_id IN (SELECT college_id FROM profiles WHERE id = auth.uid() AND role IN ('college_admin','super_admin')));


