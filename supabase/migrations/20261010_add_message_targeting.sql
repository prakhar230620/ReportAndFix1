-- Migration: Add message targeting, direct recipient and department selection
-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_role text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_target_role ON messages(target_role);
CREATE INDEX IF NOT EXISTS idx_messages_target_dept ON messages(target_department_id) WHERE target_department_id IS NOT NULL;
