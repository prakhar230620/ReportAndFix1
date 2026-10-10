-- ReportAndFix Migration: Organization Broadcasts System
-- Allows Organization Admins to broadcast messages and alerts across their organization (up to 72 hours max duration).
-- Cross-organizational interference is strictly prevented via college_id scoping and RLS policies.
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

-- 1. CREATE BROADCASTS TABLE
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'announcement', 'warning', 'urgent', 'maintenance')),
  target_roles text[] NOT NULL DEFAULT ARRAY['all']::text[],
  duration_hours int NOT NULL DEFAULT 24 CHECK (duration_hours >= 1 AND duration_hours <= 72),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- 2. INDEX FOR HIGH-PERFORMANCE ACTIVE QUERIES
CREATE INDEX IF NOT EXISTS idx_broadcasts_college_active 
  ON broadcasts (college_id, expires_at, is_active);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- 4. RLS SELECT POLICY: Only view broadcasts belonging to user's college
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view own college active broadcasts" ON broadcasts;
  CREATE POLICY "Users view own college active broadcasts"
    ON broadcasts FOR SELECT
    TO authenticated
    USING (
      college_id IN (
        SELECT college_id FROM profiles WHERE id = auth.uid()
      )
    );
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- 5. RLS INSERT POLICY: Only college_admin for their college or super_admin
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins insert broadcasts for own college" ON broadcasts;
  CREATE POLICY "Admins insert broadcasts for own college"
    ON broadcasts FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
          (role = 'college_admin' AND college_id = broadcasts.college_id)
          OR role = 'super_admin'
        )
      )
    );
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- 6. RLS UPDATE POLICY: Only college_admin for their college or super_admin
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins update own college broadcasts" ON broadcasts;
  CREATE POLICY "Admins update own college broadcasts"
    ON broadcasts FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
          (role = 'college_admin' AND college_id = broadcasts.college_id)
          OR role = 'super_admin'
        )
      )
    );
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- 7. RLS DELETE POLICY: Only college_admin for their college or super_admin
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins delete own college broadcasts" ON broadcasts;
  CREATE POLICY "Admins delete own college broadcasts"
    ON broadcasts FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
          (role = 'college_admin' AND college_id = broadcasts.college_id)
          OR role = 'super_admin'
        )
      )
    );
EXCEPTION WHEN undefined_object THEN null;
END $$;
