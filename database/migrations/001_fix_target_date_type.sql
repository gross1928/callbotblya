-- Migration: Fix target_date type from DATE to INTEGER
-- Description: Change target_date field to store months as integer instead of date

-- First, add a new column with the correct type
ALTER TABLE user_profiles ADD COLUMN target_date_new INTEGER;

-- Copy existing data (if any) - convert date to months
-- This is a placeholder since we're changing the data type completely
-- UPDATE user_profiles SET target_date_new = EXTRACT(EPOCH FROM (target_date - CURRENT_DATE)) / (30.44 * 24 * 3600) WHERE target_date IS NOT NULL;

-- Drop the old column
ALTER TABLE user_profiles DROP COLUMN target_date;

-- Rename the new column to the original name
ALTER TABLE user_profiles RENAME COLUMN target_date_new TO target_date;

-- Add comment to document the change
COMMENT ON COLUMN user_profiles.target_date IS 'Target date in months (integer) for weight goals';
