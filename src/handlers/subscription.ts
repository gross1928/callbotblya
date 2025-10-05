import { Context } from 'telegraf';
import type { CustomContext } from '../types';

/**
 * Show subscription page
 */
export async function showSubscriptionPage(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const { subscription_status, trial_end_date, subscription_end_date } = ctx.user;

    let statusText = '';
    let statusEmoji = '';
    let daysRemaining = 0;

    if (subscription_status === 'trial' && trial_end_date) {
      const trialEnd = new Date(trial_end_date);
      const now = new Date();
      daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        statusEmoji = '⏰';
        statusText = `У вас триал-период\n⏳ Осталось: <b>${daysRemaining} ${getDaysWord(daysRemaining)}</b>`;
      } else {
        statusEmoji = '⚠️';
        statusText = 'Триал-период истек\n💳 Оформите подписку для продолжения';
      }
    } else if (subscription_status === 'active' && subscription_end_date) {
      const subEnd = new Date(subscription_end_date);
      const now = new Date();
      daysRemaining = Math.ceil((subEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        statusEmoji = '✅';
        statusText = `Подписка активна\n📅 Активна до: <b>${formatDate(subEnd)}</b>\n⏳ Осталось: <b>${daysRemaining} ${getDaysWord(daysRemaining)}</b>`;
      } else {
        statusEmoji = '⚠️';
        statusText = 'Подписка истекла\n💳 Оформите подписку для продолжения';
      }
    } else {
      statusEmoji = '⚠️';
      statusText = 'Подписка истекла\n💳 Оформите подписку для продолжения';
    }

    const subscriptionText = `
${statusEmoji} <b>Подписка на бота "ДаЕда"</b>

${statusText}

━━━━━━━━━━━━━━━━━━━━

<b>🎯 Что входит в подписку:</b>

🍎 <b>Анализ еды</b>
• Распознавание фото еды через AI
• Текстовый ввод блюд
• Автоматический расчет КБЖУ
• История приемов пищи

📊 <b>Трекинг питания</b>
• Дашборд с прогресс-барами
• Детальная статистика по БЖУ
• Отслеживание калорий
• Мотивационные сообщения

💧 <b>Трекинг воды</b>
• Удобное добавление порций
• Визуальный прогресс
• История потребления

🤖 <b>AI-коуч</b>
• Персональные рекомендации
• Анализ вашего питания
• Ответы на вопросы 24/7
• Учет ваших медицинских данных

🧪 <b>Медицинские данные</b>
• Загрузка анализов
• AI-анализ результатов
• Хранение истории
• Учет в рекомендациях

📦 <b>Пользовательские продукты</b>
• Создание библиотеки продуктов
• Быстрое добавление еды
• Экономия времени

━━━━━━━━━━━━━━━━━━━━

💰 <b>Стоимость:</b> 199₽/месяц

${(subscription_status === 'trial' && daysRemaining <= 0) || subscription_status === 'expired' ? 
  '\n🎁 <b>Первые 3 дня бесплатно уже использованы</b>' : 
  subscription_status === 'trial' && daysRemaining > 0 ? 
  '\n🎁 <b>Используйте триал-период на полную!</b>' : 
  '\n✅ <b>У вас активная подписка</b>'}
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...(subscription_status === 'expired' || (subscription_status === 'trial' && daysRemaining <= 0) || 
              (subscription_status === 'active' && daysRemaining <= 3) ? 
            [[{ text: '💳 Оформить подписку', callback_data: 'buy_subscription' }]] : []),
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
        ],
      },
    };

    // Edit message if it's a callback query, otherwise send new message
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      try {
        await ctx.editMessageText(subscriptionText, { 
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup 
        });
      } catch (error) {
        await ctx.replyWithHTML(subscriptionText, keyboard);
      }
    } else {
      await ctx.replyWithHTML(subscriptionText, keyboard);
    }

  } catch (error) {
    console.error('Error showing subscription page:', error);
    await ctx.reply('❌ Не удалось загрузить информацию о подписке.');
  }
}

/**
 * Handle buy subscription button (placeholder for now)
 */
export async function handleBuySubscription(ctx: CustomContext): Promise<void> {
  try {
    await ctx.answerCbQuery();
    
    const message = `
💳 <b>Оформление подписки</b>

Для оформления подписки на бота "ДаЕда" перейдите по ссылке ниже:

[Ссылка на оплату будет добавлена позже]

После оплаты подписка активируется автоматически в течение нескольких минут.

💰 <b>Стоимость:</b> 199₽/месяц
⏰ <b>Период:</b> 30 дней

Есть вопросы? Напиши @grossvn
    `.trim();

    await ctx.reply(message, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('Error handling buy subscription:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Check if user has active subscription or trial
 */
export function hasActiveAccess(user: any): boolean {
  if (!user) return false;

  const now = new Date();

  // Check trial
  if (user.subscription_status === 'trial' && user.trial_end_date) {
    const trialEnd = new Date(user.trial_end_date);
    if (now <= trialEnd) {
      return true;
    }
  }

  // Check active subscription
  if (user.subscription_status === 'active' && user.subscription_end_date) {
    const subEnd = new Date(user.subscription_end_date);
    if (now <= subEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Show blocked message when user tries to use bot without subscription
 */
export async function showSubscriptionRequired(ctx: CustomContext): Promise<void> {
  try {
    await ctx.answerCbQuery('⚠️ Требуется подписка');
    
    const message = `
⏰ <b>Доступ ограничен</b>

Ваш триал-период истек. Для продолжения использования бота необходимо оформить подписку.

<b>Что вы получите:</b>
• 🍎 Безлимитный анализ еды
• 📊 Детальная статистика
• 🤖 AI-коуч с персональными советами
• 🧪 Анализ медицинских данных
• И многое другое!

💰 <b>Всего 199₽/месяц</b>

Нажмите кнопку ниже, чтобы оформить подписку.
    `.trim();

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оформить подписку', callback_data: 'buy_subscription' }],
          [{ text: '📋 Подробнее о подписке', callback_data: 'subscription' }],
        ],
      },
    };

    await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });

  } catch (error) {
    console.error('Error showing subscription required:', error);
  }
}

/**
 * Helper function to format date
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Helper function to get correct word form for days
 */
function getDaysWord(days: number): string {
  if (days % 10 === 1 && days % 100 !== 11) {
    return 'день';
  } else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) {
    return 'дня';
  } else {
    return 'дней';
  }
}
