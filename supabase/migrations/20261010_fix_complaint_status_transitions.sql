-- ReportAndFix Migration: Fix Complaint Status Transitions & Support Unassign
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/qhrghanmrbxsznajlzhj/sql

-- 1. DROP EXISTING RESTRICTIVE STATUS TRANSITION TRIGGERS ON complaints
DO $$
DECLARE
  trg RECORD;
BEGIN
  FOR trg IN 
    SELECT tg.tgname
    FROM pg_trigger tg
    JOIN pg_class rel ON tg.tgrelid = rel.oid
    WHERE rel.relname = 'complaints'
      AND NOT tg.tgisinternal
      AND (
        tg.tgname ILIKE '%status%'
        OR tg.tgname ILIKE '%transition%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON complaints;', trg.tgname);
    RAISE NOTICE 'Dropped trigger: %', trg.tgname;
  END LOOP;
END $$;

-- 2. CREATE PERMISSIVE & ROBUST STATUS TRANSITION TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION check_complaint_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If status did not change, allow update
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allow unassigning: assigned -> submitted or processing -> submitted
  IF (OLD.status IN ('assigned', 'processing')) AND NEW.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- Allow standard workflow transitions:
  -- submitted -> assigned, processing
  -- assigned -> submitted, processing
  -- processing -> waiting_for_verification, assigned, submitted
  -- waiting_for_verification -> completed, reopened, processing
  -- completed -> reopened, submitted, assigned
  -- reopened -> assigned, processing, submitted
  IF (OLD.status = 'submitted' AND NEW.status IN ('assigned', 'processing')) OR
     (OLD.status = 'assigned' AND NEW.status IN ('submitted', 'processing')) OR
     (OLD.status = 'processing' AND NEW.status IN ('waiting_for_verification', 'assigned', 'submitted')) OR
     (OLD.status = 'waiting_for_verification' AND NEW.status IN ('completed', 'reopened', 'processing')) OR
     (OLD.status = 'completed' AND NEW.status IN ('reopened', 'submitted', 'assigned')) OR
     (OLD.status = 'reopened' AND NEW.status IN ('assigned', 'processing', 'submitted')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid complaint status transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

-- 3. REATTACH TRIGGER
DROP TRIGGER IF EXISTS check_complaint_status_transition_trigger ON complaints;
CREATE TRIGGER check_complaint_status_transition_trigger
BEFORE UPDATE OF status ON complaints
FOR EACH ROW
EXECUTE FUNCTION check_complaint_status_transition();

-- 4. FIX UNASSIGNED COMPLAINTS (INCLUDING CMP-2026-000010)
UPDATE complaints
SET status = 'submitted'
WHERE (public_id = 'CMP-2026-000010')
   OR (assigned_worker_id IS NULL AND assigned_department_id IS NULL AND status IN ('assigned', 'completed'));
