-- Migration: Add user_sessions table
-- Description: Create table to store user registration session state

-- User Sessions Table (for storing registration state)
CREATE TABLE IF NOT EXISTS user_sessions (
    telegram_id BIGINT PRIMARY KEY,
    current_step VARCHAR(50),
    temp_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_id ON user_sessions(telegram_id);

-- Trigger for user sessions
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for user sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (true);

-- Add comment
COMMENT ON TABLE user_sessions IS 'Stores user registration session state and temporary data';
