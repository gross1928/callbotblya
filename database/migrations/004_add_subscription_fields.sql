-- Add subscription fields to user_profiles table
-- Migration 004: Add subscription support

-- Add subscription fields
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- Add index for efficient subscription status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status ON user_profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_end_date ON user_profiles(subscription_end_date);

-- Update existing users to have trial status (optional - if you want to migrate existing users)
-- UPDATE user_profiles 
-- SET subscription_status = 'trial',
--     trial_end_date = NOW() + INTERVAL '3 days'
-- WHERE subscription_status IS NULL;

-- Comment: subscription_status options:
-- 'trial' - пользователь на триале (3 дня)
-- 'active' - активная подписка
-- 'expired' - подписка истекла
