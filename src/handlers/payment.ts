import { db } from '../database/client';
import { bot } from '../bot';

/**
 * ЮKassa webhook notification structure
 */
interface YooKassaNotification {
  type: 'notification';
  event: 'payment.succeeded' | 'payment.canceled' | 'refund.succeeded';
  object: {
    id: string;
    status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
    amount: {
      value: string;
      currency: string;
    };
    description?: string;
    metadata?: {
      telegram_id?: string;
      user_id?: string;
    };
    created_at: string;
  };
}

/**
 * Handle ЮKassa webhook notifications
 */
export async function handleYooKassaWebhook(notification: YooKassaNotification): Promise<void> {
  try {
    console.log('[Payment Handler] Processing notification:', notification.event);

    // Only process successful payments
    if (notification.event !== 'payment.succeeded' || notification.object.status !== 'succeeded') {
      console.log('[Payment Handler] Skipping non-successful payment');
      return;
    }

    // Extract telegram_id from metadata
    const telegramId = notification.object.metadata?.telegram_id;
    if (!telegramId) {
      console.error('[Payment Handler] No telegram_id in metadata');
      return;
    }

    const telegramIdNumber = parseInt(telegramId);
    console.log(`[Payment Handler] Processing payment for user ${telegramIdNumber}`);

    // Check payment amount (TEST: accepting any amount >= 1 RUB)
    const amount = parseFloat(notification.object.amount.value);
    if (amount < 1) {
      console.error(`[Payment Handler] Invalid payment amount: ${amount} RUB`);
      return;
    }
    
    console.log(`[Payment Handler] Payment amount: ${amount} RUB`);

    // Activate subscription for 30 days
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

    const { error } = await db
      .from('user_profiles')
      .update({
        subscription_status: 'active',
        subscription_end_date: subscriptionEndDate.toISOString(),
      })
      .eq('telegram_id', telegramIdNumber);

    if (error) {
      console.error('[Payment Handler] Error updating subscription:', error);
      throw error;
    }

    console.log(`[Payment Handler] Subscription activated for user ${telegramIdNumber} until ${subscriptionEndDate.toISOString()}`);

    // Send notification to user
    await sendSubscriptionActivatedNotification(telegramIdNumber, subscriptionEndDate);

    console.log('[Payment Handler] Payment processed successfully');
  } catch (error) {
    console.error('[Payment Handler] Error processing webhook:', error);
    throw error;
  }
}

/**
 * Send notification to user when subscription is activated
 */
async function sendSubscriptionActivatedNotification(telegramId: number, endDate: Date): Promise<void> {
  try {
    const message = `
✅ <b>Подписка успешно активирована!</b>

Спасибо за поддержку! 💚

<b>📅 Ваша подписка активна до:</b>
${formatDate(endDate)}

<b>🎯 Теперь вам доступны:</b>
• 🍎 Безлимитный анализ еды
• 📊 Детальная статистика питания
• 🤖 AI-коуч с персональными советами
• 🧪 Анализ медицинских данных
• 💧 Трекинг воды
• 📦 Пользовательские продукты

Приятного использования! 🚀

Нажмите /start чтобы начать работу с ботом.
    `.trim();

    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`[Payment Handler] Activation notification sent to ${telegramId}`);
  } catch (error) {
    console.error(`[Payment Handler] Error sending notification to ${telegramId}:`, error);
  }
}

/**
 * Format date in Russian locale
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

