-- Migration: Ensure deleted_at IS NULL across all complaint query functions

-- 1. get_completed_issues
DROP FUNCTION IF EXISTS get_completed_issues(uuid);
CREATE OR REPLACE FUNCTION get_completed_issues(p_college_id uuid)
RETURNS TABLE (
  id uuid,
  public_id text,
  title text,
  completed_at timestamptz,
  resolution_seconds int,
  category_name text,
  location_name text,
  vote_count bigint,
  before_media_path text,
  after_media_path text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.public_id,
    c.title,
    c.completed_at,
    c.resolution_seconds,
    cat.name AS category_name,
    loc.name AS location_name,
    COALESCE(COUNT(v.id), 0) AS vote_count,
    (
      SELECT m.storage_path
      FROM complaint_media m
      WHERE m.complaint_id = c.id AND m.media_type = 'before'
      ORDER BY m.created_at ASC
      LIMIT 1
    ) AS before_media_path,
    (
      SELECT m.storage_path
      FROM complaint_media m
      WHERE m.complaint_id = c.id AND m.media_type = 'after'
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS after_media_path
  FROM complaints c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN locations loc ON loc.id = c.location_id
  LEFT JOIN complaint_votes v ON v.complaint_id = c.id
  WHERE c.college_id = p_college_id
    AND c.status = 'completed'
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.public_id, c.title, c.completed_at, c.resolution_seconds, cat.name, loc.name
  ORDER BY c.completed_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_completed_issues(uuid) TO anon, authenticated, service_role;

-- 2. get_today_open_issues
DROP FUNCTION IF EXISTS get_today_open_issues(uuid);
CREATE OR REPLACE FUNCTION get_today_open_issues(p_college_id uuid)
RETURNS TABLE (
  id uuid,
  public_id text,
  title text,
  status text,
  priority text,
  category_name text,
  location_name text,
  vote_count bigint,
  before_media_path text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.public_id,
    c.title,
    c.status::text,
    c.priority::text,
    cat.name AS category_name,
    loc.name AS location_name,
    COALESCE(COUNT(v.id), 0) AS vote_count,
    (
      SELECT m.storage_path
      FROM complaint_media m
      WHERE m.complaint_id = c.id AND m.media_type = 'before'
      ORDER BY m.created_at ASC
      LIMIT 1
    ) AS before_media_path
  FROM complaints c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN locations loc ON loc.id = c.location_id
  LEFT JOIN complaint_votes v ON v.complaint_id = c.id
  WHERE c.college_id = p_college_id
    AND c.status != 'completed'
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.public_id, c.title, c.status, c.priority, cat.name, loc.name
  ORDER BY c.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_today_open_issues(uuid) TO anon, authenticated, service_role;

-- 3. get_admin_queue
-- Drop ALL possible overloads (old enum-typed + new text-typed) to avoid PGRST203 conflict
DROP FUNCTION IF EXISTS get_admin_queue(uuid, text, uuid, uuid);
DROP FUNCTION IF EXISTS get_admin_queue(uuid, public.complaint_status, uuid, uuid);
DROP FUNCTION IF EXISTS get_admin_queue(uuid);
CREATE OR REPLACE FUNCTION get_admin_queue(
  p_college_id uuid,
  p_status text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  public_id text,
  title text,
  status text,
  priority text,
  created_at timestamptz,
  assigned_worker_id uuid,
  assigned_department_id uuid,
  category_name text,
  location_name text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.public_id,
    c.title,
    c.status::text,
    c.priority::text,
    c.created_at,
    c.assigned_worker_id,
    c.assigned_department_id,
    cat.name AS category_name,
    loc.name AS location_name
  FROM complaints c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN locations loc ON loc.id = c.location_id
  WHERE c.college_id = p_college_id
    AND c.deleted_at IS NULL
    AND (p_status IS NULL OR c.status::text = p_status)
    AND (p_category_id IS NULL OR c.category_id = p_category_id)
    AND (p_location_id IS NULL OR c.location_id = p_location_id)
  ORDER BY c.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_admin_queue(uuid, text, uuid, uuid) TO authenticated, service_role;

