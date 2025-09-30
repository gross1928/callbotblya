import { Context } from 'telegraf';
import { addWaterEntry, getWaterEntriesByDate } from '../database/queries';
import { calculateProgress, generateWaterProgressBar, formatWater } from '../utils/calculations';
import { editOrReply } from '../utils/telegram';
import type { CustomContext } from '../types';

/**
 * Add water entry and update message
 */
export async function addWater(ctx: CustomContext, amount: number): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const entry = {
      user_id: ctx.user.id,
      amount: amount,
      timestamp: new Date().toISOString(),
    };

    await addWaterEntry(entry);

    // Update the water menu message
    await updateWaterMenuMessage(ctx);

  } catch (error) {
    console.error('Error adding water:', error);
    await ctx.reply('❌ Не удалось добавить воду. Попробуй еще раз.');
  }
}

/**
 * Update water menu message with current data
 */
export async function updateWaterMenuMessage(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      return;
    }

    // Get today's water data
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = await getWaterEntriesByDate(ctx.user.id, today);
    const totalToday = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const target = 2000; // Default target
    const progress = calculateProgress(totalToday, target);

    const waterText = `
💧 <b>Отслеживание воды</b>

Сегодня: ${formatWater(totalToday)}/${formatWater(target)} (${progress}%)

${generateWaterProgressBar(progress)}

${getWaterMotivation(progress)}

Выберите количество для добавления:
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💧 100мл', callback_data: 'water_100' },
            { text: '🥤 250мл', callback_data: 'water_250' },
          ],
          [
            { text: '🍶 500мл', callback_data: 'water_500' },
            { text: '🍼 750мл', callback_data: 'water_750' },
          ],
          [
            { text: '📋 История воды', callback_data: 'water_history' },
            { text: '📊 Дашборд', callback_data: 'dashboard' },
          ],
          [
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    // Edit the message instead of sending new one
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      await ctx.editMessageText(waterText, { 
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup 
      });
      await ctx.answerCbQuery(`💧 Вода добавлена!`);
    } else {
      await ctx.replyWithHTML(waterText, keyboard);
    }

  } catch (error) {
    console.error('Error updating water menu:', error);
  }
}

/**
 * Show water tracking menu
 */
export async function showWaterMenu(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    // Get today's water data
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = await getWaterEntriesByDate(ctx.user.id, today);
    const totalToday = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const target = 2000; // Default target
    const progress = calculateProgress(totalToday, target);

    const waterText = `
💧 <b>Отслеживание воды</b>

Сегодня: ${formatWater(totalToday)}/${formatWater(target)} (${progress}%)

${generateWaterProgressBar(progress)}

${getWaterMotivation(progress)}

Выберите количество для добавления:
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💧 100мл', callback_data: 'water_100' },
            { text: '🥤 250мл', callback_data: 'water_250' },
          ],
          [
            { text: '🍶 500мл', callback_data: 'water_500' },
            { text: '🍼 750мл', callback_data: 'water_750' },
          ],
          [
            { text: '📋 История воды', callback_data: 'water_history' },
            { text: '📊 Дашборд', callback_data: 'dashboard' },
          ],
          [
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await editOrReply(ctx, waterText, keyboard);

  } catch (error) {
    console.error('Error showing water menu:', error);
    await ctx.reply('❌ Не удалось загрузить меню воды.');
  }
}

/**
 * Show water history
 */
export async function showWaterHistory(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayEntries = await getWaterEntriesByDate(ctx.user.id, today);

    if (todayEntries.length === 0) {
      await ctx.reply('💧 Сегодня ты еще не пил воду.');
      return;
    }

    let historyText = '💧 <b>История воды сегодня:</b>\n\n';
    let totalAmount = 0;

    todayEntries.forEach((entry, index) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      historyText += `${index + 1}. ${time} - ${formatWater(entry.amount)}\n`;
      totalAmount += entry.amount;
    });

    const target = 2000;
    const progress = calculateProgress(totalAmount, target);

    historyText += `\n<b>Всего сегодня:</b> ${formatWater(totalAmount)}/${formatWater(target)} (${progress}%)\n`;
    historyText += `${generateWaterProgressBar(progress)}\n`;
    historyText += getWaterMotivation(progress);

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💧 Добавить воду', callback_data: 'add_water' },
            { text: '📊 Дашборд', callback_data: 'dashboard' },
          ],
          [
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(historyText, keyboard);

  } catch (error) {
    console.error('Error showing water history:', error);
    await ctx.reply('❌ Не удалось загрузить историю воды.');
  }
}

/**
 * Get motivational message for water tracking
 */
function getWaterMotivation(progress: number): string {
  if (progress >= 100) {
    return '\n🎉 Отлично! Ты достиг дневной нормы воды!';
  } else if (progress >= 80) {
    return '\n👍 Почти достиг цели! Осталось совсем немного!';
  } else if (progress >= 50) {
    return '\n💪 Хороший прогресс! Продолжай пить воду!';
  } else if (progress >= 25) {
    return '\n💧 Не забывай пить воду в течение дня!';
  } else {
    return '\n🚰 Начни день с воды! Это важно для здоровья!';
  }
}

/**
 * Show water statistics for the week
 */
export async function showWaterStats(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    // Get water entries for the last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);

    // This would require a more complex query, for now showing today's data
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = await getWaterEntriesByDate(ctx.user.id, today);
    const totalToday = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const statsText = `
📊 <b>Статистика воды</b>

<b>Сегодня:</b> ${formatWater(totalToday)}
<b>Цель:</b> ${formatWater(2000)}
<b>Прогресс:</b> ${calculateProgress(totalToday, 2000)}%

${generateWaterProgressBar(calculateProgress(totalToday, 2000))}

💡 <b>Советы:</b>
• Пей воду сразу после пробуждения
• Носи с собой бутылку воды
• Добавляй лимон или мяту для вкуса
• Ешь больше фруктов и овощей
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💧 Добавить воду', callback_data: 'add_water' },
            { text: '📋 История', callback_data: 'water_history' },
          ],
          [
            { text: '📊 Дашборд', callback_data: 'dashboard' },
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(statsText, keyboard);

  } catch (error) {
    console.error('Error showing water stats:', error);
    await ctx.reply('❌ Не удалось загрузить статистику воды.');
  }
}
