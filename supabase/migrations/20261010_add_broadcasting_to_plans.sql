-- Add broadcasting_enabled to plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS broadcasting_enabled bool NOT NULL DEFAULT false;

-- Enable broadcasting by default for higher plans (Professional and Enterprise)
UPDATE plans 
SET broadcasting_enabled = true 
WHERE slug IN ('professional', 'enterprise');

-- Add broadcasting feature description to features list of Professional and Enterprise if not present
UPDATE plans
SET features = features || '["Organisation Broadcasts & Alerts"]'::jsonb
WHERE slug IN ('professional', 'enterprise')
  AND NOT (features @> '["Organisation Broadcasts & Alerts"]'::jsonb);
