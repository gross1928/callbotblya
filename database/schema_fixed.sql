-- Fixed Database Schema for DaEda Bot
-- This schema includes all fixes and should be used for new projects

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL CHECK (age > 0 AND age < 150),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    height DECIMAL(5,2) NOT NULL CHECK (height > 0),
    weight DECIMAL(5,2) NOT NULL CHECK (weight > 0),
    activity_level VARCHAR(20) NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal VARCHAR(20) NOT NULL CHECK (goal IN ('lose', 'maintain', 'gain')),
    target_weight DECIMAL(5,2),
    target_date INTEGER, -- Fixed: INTEGER instead of DATE
    bmr DECIMAL(8,2) NOT NULL,
    tdee DECIMAL(8,2) NOT NULL,
    target_calories INTEGER NOT NULL,
    target_protein INTEGER NOT NULL,
    target_fat INTEGER NOT NULL,
    target_carbs INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food Entries Table
CREATE TABLE IF NOT EXISTS food_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Water Entries Table
CREATE TABLE IF NOT EXISTS water_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical Data Table
CREATE TABLE IF NOT EXISTS medical_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('blood', 'hormones', 'urine', 'other')),
    date DATE NOT NULL,
    data JSONB NOT NULL,
    analysis TEXT,
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Messages Table (for AI Coach)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions Table (for storing registration state)
CREATE TABLE IF NOT EXISTS user_sessions (
    telegram_id BIGINT PRIMARY KEY,
    current_step VARCHAR(50),
    temp_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_id ON user_profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_id ON food_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_timestamp ON food_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_water_entries_user_id ON water_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_water_entries_timestamp ON water_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_medical_data_user_id ON medical_data(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_data_date ON medical_data(date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_id ON user_sessions(telegram_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (true);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own food entries" ON food_entries
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own food entries" ON food_entries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own water entries" ON water_entries
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own water entries" ON water_entries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own medical data" ON medical_data
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own medical data" ON medical_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (true);

-- Comments
COMMENT ON TABLE user_profiles IS 'User profiles with personal and goal information';
COMMENT ON TABLE food_entries IS 'Food consumption tracking entries';
COMMENT ON TABLE water_entries IS 'Water intake tracking entries';
COMMENT ON TABLE medical_data IS 'Medical test results and analysis';
COMMENT ON TABLE chat_messages IS 'AI coach conversation history';
COMMENT ON TABLE user_sessions IS 'Stores user registration session state and temporary data';
COMMENT ON COLUMN user_profiles.target_date IS 'Target date in months (integer) for weight goals';
