import { db } from '../database/client';
import { bot } from '../bot';

/**
 * Check all users for expired subscriptions and send notifications
 * This should be called periodically (e.g., once per day via cron)
 */
export async function checkExpiredSubscriptions(): Promise<void> {
  try {
    console.log('[Subscription Checker] Starting subscription check...');

    const now = new Date();

    // Get all users with trial or active subscriptions
    const { data: users, error } = await db
      .from('user_profiles')
      .select('telegram_id, subscription_status, trial_end_date, subscription_end_date')
      .in('subscription_status', ['trial', 'active']);

    if (error) {
      console.error('[Subscription Checker] Error fetching users:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[Subscription Checker] No users to check');
      return;
    }

    console.log(`[Subscription Checker] Checking ${users.length} users...`);

    let expiredCount = 0;
    let notifiedCount = 0;

    for (const user of users) {
      try {
        // Check trial expiration
        if (user.subscription_status === 'trial' && user.trial_end_date) {
          const trialEnd = new Date(user.trial_end_date);
          
          // If trial expired
          if (now > trialEnd) {
            await updateUserSubscriptionStatus(user.telegram_id, 'expired');
            await sendTrialExpiredNotification(user.telegram_id);
            expiredCount++;
          }
          // If trial expires in 1 day
          else {
            const hoursRemaining = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursRemaining <= 24 && hoursRemaining > 0) {
              await sendTrialExpiringNotification(user.telegram_id, trialEnd);
              notifiedCount++;
            }
          }
        }

        // Check subscription expiration
        if (user.subscription_status === 'active' && user.subscription_end_date) {
          const subEnd = new Date(user.subscription_end_date);
          
          // If subscription expired
          if (now > subEnd) {
            await updateUserSubscriptionStatus(user.telegram_id, 'expired');
            await sendSubscriptionExpiredNotification(user.telegram_id);
            expiredCount++;
          }
          // If subscription expires in 1 day
          else {
            const hoursRemaining = (subEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursRemaining <= 24 && hoursRemaining > 0) {
              await sendSubscriptionExpiringNotification(user.telegram_id, subEnd);
              notifiedCount++;
            }
          }
        }
      } catch (userError) {
        console.error(`[Subscription Checker] Error processing user ${user.telegram_id}:`, userError);
      }
    }

    console.log(`[Subscription Checker] Check complete: ${expiredCount} expired, ${notifiedCount} notified`);

  } catch (error) {
    console.error('[Subscription Checker] Fatal error:', error);
  }
}

/**
 * Update user subscription status in database
 */
async function updateUserSubscriptionStatus(telegramId: number, status: 'expired'): Promise<void> {
  const { error } = await db
    .from('user_profiles')
    .update({ subscription_status: status })
    .eq('telegram_id', telegramId);

  if (error) {
    console.error(`[Subscription Checker] Error updating status for user ${telegramId}:`, error);
  }
}

/**
 * Send notification when trial is about to expire (24 hours)
 */
async function sendTrialExpiringNotification(telegramId: number, expiryDate: Date): Promise<void> {
  try {
    const message = `
⏰ <b>Напоминание о триале</b>

Ваш триал-период истекает завтра (${expiryDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })})!

Не забудьте оформить подписку, чтобы продолжить пользоваться всеми функциями бота.

💰 <b>Стоимость:</b> 199₽/месяц

Нажмите /subscription чтобы оформить подписку.
    `.trim();

    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`[Subscription Checker] Trial expiring notification sent to ${telegramId}`);
  } catch (error) {
    console.error(`[Subscription Checker] Error sending trial expiring notification to ${telegramId}:`, error);
  }
}

/**
 * Send notification when trial has expired
 */
async function sendTrialExpiredNotification(telegramId: number): Promise<void> {
  try {
    const message = `
⏰ <b>Триал-период истек</b>

Ваш бесплатный триал-период на 3 дня завершился.

Чтобы продолжить пользоваться всеми функциями бота, оформите подписку.

<b>🎯 Что вы получите:</b>
• 🍎 Безлимитный анализ еды
• 📊 Детальная статистика
• 🤖 AI-коуч с персональными советами
• 🧪 Анализ медицинских данных
• И многое другое!

💰 <b>Стоимость:</b> 199₽/месяц

Нажмите /subscription чтобы оформить подписку.
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оформить подписку', callback_data: 'buy_subscription' }],
        ],
      },
    };

    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML', ...keyboard });
    console.log(`[Subscription Checker] Trial expired notification sent to ${telegramId}`);
  } catch (error) {
    console.error(`[Subscription Checker] Error sending trial expired notification to ${telegramId}:`, error);
  }
}

/**
 * Send notification when subscription is about to expire (24 hours)
 */
async function sendSubscriptionExpiringNotification(telegramId: number, expiryDate: Date): Promise<void> {
  try {
    const message = `
⏰ <b>Напоминание о подписке</b>

Ваша подписка истекает завтра (${expiryDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })})!

Продлите подписку, чтобы продолжить пользоваться всеми функциями бота.

💰 <b>Стоимость:</b> 199₽/месяц

Нажмите /subscription чтобы продлить подписку.
    `.trim();

    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`[Subscription Checker] Subscription expiring notification sent to ${telegramId}`);
  } catch (error) {
    console.error(`[Subscription Checker] Error sending subscription expiring notification to ${telegramId}:`, error);
  }
}

/**
 * Send notification when subscription has expired
 */
async function sendSubscriptionExpiredNotification(telegramId: number): Promise<void> {
  try {
    const message = `
⏰ <b>Подписка истекла</b>

Ваша подписка завершилась.

Продлите подписку, чтобы продолжить пользоваться всеми функциями бота.

<b>🎯 Что вы получите:</b>
• 🍎 Безлимитный анализ еды
• 📊 Детальная статистика
• 🤖 AI-коуч с персональными советами
• 🧪 Анализ медицинских данных
• И многое другое!

💰 <b>Стоимость:</b> 199₽/месяц

Нажмите /subscription чтобы продлить подписку.
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Продлить подписку', callback_data: 'buy_subscription' }],
        ],
      },
    };

    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML', ...keyboard });
    console.log(`[Subscription Checker] Subscription expired notification sent to ${telegramId}`);
  } catch (error) {
    console.error(`[Subscription Checker] Error sending subscription expired notification to ${telegramId}:`, error);
  }
}

/**
 * Start periodic subscription checking (every 12 hours)
 */
export function startSubscriptionChecker(): void {
  console.log('[Subscription Checker] Starting periodic checker...');
  
  // Run immediately on startup
  checkExpiredSubscriptions();
  
  // Run every 12 hours (12 * 60 * 60 * 1000 = 43200000 ms)
  setInterval(checkExpiredSubscriptions, 12 * 60 * 60 * 1000);
  
  console.log('[Subscription Checker] Periodic checker started (runs every 12 hours)');
}
