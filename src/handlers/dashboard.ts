import { Context } from 'telegraf';
import { getDashboardData } from '../database/queries';
import { calculateProgress, generateProgressBar, formatCalories, formatMacros, formatWater } from '../utils/calculations';
import type { CustomContext, DashboardData } from '../types';

/**
 * Show dashboard with today's data
 */
export async function showDashboard(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const dashboardData = await getDashboardData(ctx.user.id, today);

    await displayDashboard(ctx, dashboardData);

  } catch (error) {
    console.error('Error showing dashboard:', error);
    await ctx.reply('❌ Не удалось загрузить дашборд. Попробуй еще раз.');
  }
}

/**
 * Display dashboard data with progress bars
 */
async function displayDashboard(ctx: CustomContext, data: DashboardData): Promise<void> {
  const { calories, macros, water, weight } = data;

  // Calculate progress percentages
  const caloriesProgress = calculateProgress(calories.consumed, calories.target);
  const proteinProgress = calculateProgress(macros.protein.consumed, macros.protein.target);
  const fatProgress = calculateProgress(macros.fat.consumed, macros.fat.target);
  const carbsProgress = calculateProgress(macros.carbs.consumed, macros.carbs.target);
  const waterProgress = calculateProgress(water.consumed, water.target);

  // Generate progress bars
  const caloriesBar = generateProgressBar(caloriesProgress);
  const proteinBar = generateProgressBar(proteinProgress);
  const fatBar = generateProgressBar(fatProgress);
  const carbsBar = generateProgressBar(carbsProgress);
  const waterBar = generateProgressBar(waterProgress);

  // Determine emojis based on progress
  const caloriesEmoji = caloriesProgress >= 100 ? '🎯' : caloriesProgress >= 80 ? '📈' : '📊';
  const waterEmoji = waterProgress >= 100 ? '💧' : waterProgress >= 80 ? '💦' : '🚰';

  const dashboardText = `
📊 <b>Дашборд на ${new Date().toLocaleDateString('ru-RU')}</b>

${caloriesEmoji} <b>Калории</b>
${calories.consumed}/${calories.target} ккал (${caloriesProgress}%)
${caloriesBar}

🥗 <b>Макронутриенты</b>
<b>Белки:</b> ${macros.protein.consumed}/${macros.protein.target}г (${proteinProgress}%)
${proteinBar}

<b>Жиры:</b> ${macros.fat.consumed}/${macros.fat.target}г (${fatProgress}%)
${fatBar}

<b>Углеводы:</b> ${macros.carbs.consumed}/${macros.carbs.target}г (${carbsProgress}%)
${carbsBar}

${waterEmoji} <b>Вода</b>
${formatWater(water.consumed)}/${formatWater(water.target)} (${waterProgress}%)
${waterBar}

${weight ? `⚖️ <b>Вес:</b> ${weight} кг` : ''}

${getMotivationalMessage(caloriesProgress, waterProgress)}
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🍎 Добавить еду', callback_data: 'add_food' },
          { text: '💧 Добавить воду', callback_data: 'add_water' },
        ],
        [
          { text: '📋 История еды', callback_data: 'food_history' },
          { text: '🤖 AI-коуч', callback_data: 'ai_coach' },
        ],
        [
          { text: '🔄 Обновить', callback_data: 'dashboard' },
          { text: '🔙 Главное меню', callback_data: 'main_menu' },
        ],
      ],
    },
  };

  await ctx.replyWithHTML(dashboardText, keyboard);
}

/**
 * Get motivational message based on progress
 */
function getMotivationalMessage(caloriesProgress: number, waterProgress: number): string {
  if (caloriesProgress >= 100 && waterProgress >= 100) {
    return '\n🎉 Отличная работа! Ты достиг всех целей на сегодня!';
  } else if (caloriesProgress >= 80 && waterProgress >= 80) {
    return '\n👍 Хороший прогресс! Осталось совсем немного!';
  } else if (caloriesProgress < 50 || waterProgress < 50) {
    return '\n💪 Не забывай про питание и воду! Ты справишься!';
  } else {
    return '\n📈 Продолжай в том же духе!';
  }
}

/**
 * Show detailed nutrition breakdown
 */
export async function showNutritionBreakdown(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const dashboardData = await getDashboardData(ctx.user.id, today);

    const { calories, macros } = dashboardData;
    const remainingCalories = calories.target - calories.consumed;
    const remainingProtein = macros.protein.target - macros.protein.consumed;
    const remainingFat = macros.fat.target - macros.fat.consumed;
    const remainingCarbs = macros.carbs.target - macros.carbs.consumed;

    const breakdownText = `
🥗 <b>Детальная разбивка питания</b>

📊 <b>Калории:</b>
• Съедено: ${calories.consumed} ккал
• Цель: ${calories.target} ккал
• Осталось: ${remainingCalories > 0 ? remainingCalories : 0} ккал

🥩 <b>Белки:</b>
• Съедено: ${macros.protein.consumed}г
• Цель: ${macros.protein.target}г
• Осталось: ${remainingProtein > 0 ? remainingProtein : 0}г

🥑 <b>Жиры:</b>
• Съедено: ${macros.fat.consumed}г
• Цель: ${macros.fat.target}г
• Осталось: ${remainingFat > 0 ? remainingFat : 0}г

🍞 <b>Углеводы:</b>
• Съедено: ${macros.carbs.consumed}г
• Цель: ${macros.carbs.target}г
• Осталось: ${remainingCarbs > 0 ? remainingCarbs : 0}г

${getNutritionAdvice(remainingCalories, remainingProtein, remainingFat, remainingCarbs)}
  `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Общий дашборд', callback_data: 'dashboard' }],
          [{ text: '🍎 Добавить еду', callback_data: 'add_food' }],
        ],
      },
    };

    await ctx.replyWithHTML(breakdownText, keyboard);

  } catch (error) {
    console.error('Error showing nutrition breakdown:', error);
    await ctx.reply('❌ Не удалось загрузить разбивку питания.');
  }
}

/**
 * Get nutrition advice based on remaining macros
 */
function getNutritionAdvice(
  remainingCalories: number,
  remainingProtein: number,
  remainingFat: number,
  remainingCarbs: number
): string {
  if (remainingCalories <= 0) {
    return '\n⚠️ Ты уже достиг дневной нормы калорий!';
  }

  const advice = [];
  
  if (remainingProtein > 20) {
    advice.push('🥩 Добавь больше белка (мясо, рыба, яйца, творог)');
  }
  
  if (remainingFat > 15) {
    advice.push('🥑 Добавь полезные жиры (орехи, авокадо, оливковое масло)');
  }
  
  if (remainingCarbs > 30) {
    advice.push('🍞 Добавь углеводы (каши, фрукты, овощи)');
  }

  if (advice.length === 0) {
    return '\n✅ Твой баланс БЖУ выглядит хорошо!';
  }

  return '\n💡 <b>Рекомендации:</b>\n' + advice.join('\n');
}
