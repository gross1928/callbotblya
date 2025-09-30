-- Debug user session for telegram_id 6103273611
-- Run this in Supabase SQL Editor

-- Check current session
SELECT 
    telegram_id,
    current_step,
    temp_data,
    created_at,
    updated_at
FROM user_sessions 
WHERE telegram_id = 6103273611;

-- Check if temp_data contains any food analyses
SELECT 
    telegram_id,
    current_step,
    jsonb_object_keys(temp_data) as temp_data_keys,
    temp_data
FROM user_sessions 
WHERE telegram_id = 6103273611;

-- Check recent updates
SELECT 
    telegram_id,
    current_step,
    updated_at,
    NOW() - updated_at as time_since_update
FROM user_sessions 
WHERE telegram_id = 6103273611;
