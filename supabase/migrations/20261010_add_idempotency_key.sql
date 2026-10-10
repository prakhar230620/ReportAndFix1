-- Migration: Add idempotency_key to complaint_media for duplicate-upload prevention
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

ALTER TABLE complaint_media
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Unique constraint so two uploads with same key share one row (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS complaint_media_idempotency_key_idx
  ON complaint_media (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
