[1mdiff --git a/database/debug_session.sql b/database/debug_session.sql[m
[1mnew file mode 100644[m
[1mindex 0000000..37d988e[m
[1m--- /dev/null[m
[1m+++ b/database/debug_session.sql[m
[36m@@ -0,0 +1,30 @@[m
[32m+[m[32m-- Debug user session for telegram_id 6103273611[m
[32m+[m[32m-- Run this in Supabase SQL Editor[m
[32m+[m
[32m+[m[32m-- Check current session[m
[32m+[m[32mSELECT[m[41m [m
[32m+[m[32m    telegram_id,[m
[32m+[m[32m    current_step,[m
[32m+[m[32m    temp_data,[m
[32m+[m[32m    created_at,[m
[32m+[m[32m    updated_at[m
[32m+[m[32mFROM user_sessions[m[41m [m
[32m+[m[32mWHERE telegram_id = 6103273611;[m
[32m+[m
[32m+[m[32m-- Check if temp_data contains any food analyses[m
[32m+[m[32mSELECT[m[41m [m
[32m+[m[32m    telegram_id,[m
[32m+[m[32m    current_step,[m
[32m+[m[32m    jsonb_object_keys(temp_data) as temp_data_keys,[m
[32m+[m[32m    temp_data[m
[32m+[m[32mFROM user_sessions[m[41m [m
[32m+[m[32mWHERE telegram_id = 6103273611;[m
[32m+[m
[32m+[m[32m-- Check recent updates[m
[32m+[m[32mSELECT[m[41m [m
[32m+[m[32m    telegram_id,[m
[32m+[m[32m    current_step,[m
[32m+[m[32m    updated_at,[m
[32m+[m[32m    NOW() - updated_at as time_since_update[m
[32m+[m[32mFROM user_sessions[m[41m [m
[32m+[m[32mWHERE telegram_id = 6103273611;[m
[1mdiff --git a/src/handlers/dashboard.ts b/src/handlers/dashboard.ts[m
[1mindex a1c12b0..536f2f5 100644[m
[1m--- a/src/handlers/dashboard.ts[m
[1m+++ b/src/handlers/dashboard.ts[m
[36m@@ -14,7 +14,7 @@[m [mexport async function showDashboard(ctx: CustomContext): Promise<void> {[m
     }[m
 [m
     const today = new Date().toISOString().split('T')[0];[m
[31m-    const dashboardData = await getDashboardData(ctx.user.id, today);[m
[32m+[m[32m    const dashboardData = await getDashboardData(ctx.user.telegram_id.toString(), today);[m
 [m
     await displayDashboard(ctx, dashboardData);[m
 [m
[36m@@ -34,7 +34,7 @@[m [mexport async function updateDashboardMessage(ctx: CustomContext): Promise<void>[m
     }[m
 [m
     const today = new Date().toISOString().split('T')[0];[m
[31m-    const dashboardData = await getDashboardData(ctx.user.id, today);[m
[32m+[m[32m    const dashboardData = await getDashboardData(ctx.user.telegram_id.toString(), today);[m
 [m
     await displayDashboard(ctx, dashboardData);[m
 [m
[36m@@ -154,7 +154,7 @@[m [mexport async function showNutritionBreakdown(ctx: CustomContext): Promise<void>[m
     }[m
 [m
     const today = new Date().toISOString().split('T')[0];[m
[31m-    const dashboardData = await getDashboardData(ctx.user.id, today);[m
[32m+[m[32m    const dashboardData = await getDashboardData(ctx.user.telegram_id.toString(), today);[m
 [m
     const { calories, macros } = dashboardData;[m
     const remainingCalories = calories.target - calories.consumed;[m
