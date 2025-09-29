-- Check if user_sessions table exists and create if not
-- Run this in Supabase SQL Editor

-- First, check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_sessions';

-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS user_sessions (
    telegram_id BIGINT PRIMARY KEY,
    current_step VARCHAR(50),
    temp_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_id ON user_sessions(telegram_id);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (true);

-- Test insert
INSERT INTO user_sessions (telegram_id, current_step, temp_data) 
VALUES (123456789, 'test', '{"test": "data"}'::jsonb)
ON CONFLICT (telegram_id) DO UPDATE SET
    current_step = EXCLUDED.current_step,
    temp_data = EXCLUDED.temp_data,
    updated_at = NOW();

-- Test select
SELECT * FROM user_sessions WHERE telegram_id = 123456789;

-- Clean up test data
DELETE FROM user_sessions WHERE telegram_id = 123456789;
