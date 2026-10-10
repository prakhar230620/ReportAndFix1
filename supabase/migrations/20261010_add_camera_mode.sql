-- Migration: Add camera_mode to colleges table if not exists
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

ALTER TABLE colleges ADD COLUMN IF NOT EXISTS camera_mode text DEFAULT 'both';
