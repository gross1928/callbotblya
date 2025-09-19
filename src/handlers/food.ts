import { Context } from 'telegraf';
import { analyzeFoodFromPhoto, analyzeFoodFromText } from '../utils/openai';
import { addFoodEntry } from '../database/queries';
import { formatCalories, formatMacros } from '../utils/calculations';
import type { CustomContext, FoodAnalysis, MealType } from '../types';

/**
 * Handle food photo analysis
 */
export async function handleFoodPhotoAnalysis(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.message || !('photo' in ctx.message)) {
      await ctx.reply('Пожалуйста, отправь фото еды.');
      return;
    }

    const photo = ctx.message.photo;
    const largestPhoto = photo[photo.length - 1]; // Get highest resolution photo
    
    // Get file info from Telegram
    const fileInfo = await ctx.telegram.getFile(largestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.telegram.token}/${fileInfo.file_path}`;

    await ctx.reply('🔍 Анализирую фото еды...');

    // Analyze food using OpenAI Vision API
    const analysis = await analyzeFoodFromPhoto(fileUrl);
    
    // Show analysis results
    await showFoodAnalysis(ctx, analysis);

  } catch (error) {
    console.error('Error analyzing food photo:', error);
    await ctx.reply('❌ Не удалось проанализировать фото. Попробуй еще раз или опиши блюдо текстом.');
  }
}

/**
 * Handle food text analysis
 */
export async function handleFoodTextAnalysis(ctx: CustomContext, text: string): Promise<void> {
  try {
    if (!text || text.trim().length < 3) {
      await ctx.reply('Пожалуйста, опиши что ты съел более подробно (например: "Овсянка 100г с бананом 150г")');
      return;
    }

    await ctx.reply('🔍 Анализирую описание еды...');

    // Analyze food using OpenAI text API
    const analysis = await analyzeFoodFromText(text);
    
    // Show analysis results
    await showFoodAnalysis(ctx, analysis);

  } catch (error) {
    console.error('Error analyzing food text:', error);
    await ctx.reply('❌ Не удалось проанализировать описание. Попробуй быть более конкретным.');
  }
}

/**
 * Show food analysis results with action buttons
 */
async function showFoodAnalysis(ctx: CustomContext, analysis: FoodAnalysis): Promise<void> {
  const analysisText = `
🍎 <b>Анализ еды</b>

<b>Блюдо:</b> ${analysis.name}
<b>Вес:</b> ${analysis.weight}г
<b>Ингредиенты:</b> ${analysis.ingredients.join(', ')}

<b>КБЖУ:</b>
• Калории: ${formatCalories(analysis.calories)}
• ${formatMacros({ protein: analysis.protein, fat: analysis.fat, carbs: analysis.carbs })}
${analysis.fiber ? `• Клетчатка: ${analysis.fiber}г` : ''}
${analysis.sugar ? `• Сахар: ${analysis.sugar}г` : ''}

Сохранить этот прием пищи?
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🌅 Завтрак', callback_data: `save_food_breakfast_${JSON.stringify(analysis)}` },
          { text: '🌞 Обед', callback_data: `save_food_lunch_${JSON.stringify(analysis)}` },
        ],
        [
          { text: '🌙 Ужин', callback_data: `save_food_dinner_${JSON.stringify(analysis)}` },
          { text: '🍪 Перекус', callback_data: `save_food_snack_${JSON.stringify(analysis)}` },
        ],
        [
          { text: '✏️ Изменить', callback_data: `edit_food_${JSON.stringify(analysis)}` },
          { text: '❌ Отмена', callback_data: 'cancel_food' },
        ],
      ],
    },
  };

  await ctx.replyWithHTML(analysisText, keyboard);
}

/**
 * Save food entry to database
 */
export async function saveFoodEntry(ctx: CustomContext, mealType: MealType, analysis: FoodAnalysis): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const entry = {
      user_id: ctx.user.id,
      meal_type: mealType,
      food_data: analysis,
      timestamp: new Date().toISOString(),
    };

    await addFoodEntry(entry);

    const mealTypeText = getMealTypeText(mealType);
    const successMessage = `
✅ <b>${mealTypeText} добавлен!</b>

🍎 ${analysis.name} (${analysis.weight}г)
${formatCalories(analysis.calories)} | ${formatMacros({ protein: analysis.protein, fat: analysis.fat, carbs: analysis.carbs })}
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
          [{ text: '🍎 Добавить еще еду', callback_data: 'add_food' }],
        ],
      },
    };

    await ctx.replyWithHTML(successMessage, keyboard);

  } catch (error) {
    console.error('Error saving food entry:', error);
    await ctx.reply('❌ Не удалось сохранить прием пищи. Попробуй еще раз.');
  }
}

/**
 * Handle food editing
 */
export async function handleFoodEdit(ctx: CustomContext, analysis: FoodAnalysis): Promise<void> {
  await ctx.reply(
    '✏️ <b>Редактирование еды</b>\n\n' +
    'Сейчас доступно только сохранение с текущими параметрами.\n' +
    'Функция редактирования будет добавлена в следующих версиях.',
    { parse_mode: 'HTML' }
  );
}

/**
 * Get meal type text in Russian
 */
function getMealTypeText(mealType: MealType): string {
  const types = {
    breakfast: 'Завтрак',
    lunch: 'Обед',
    dinner: 'Ужин',
    snack: 'Перекус',
  };
  return types[mealType];
}

/**
 * Show food history for today
 */
export async function showFoodHistory(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const entries = await getFoodEntriesByDate(ctx.user.id, today);

    if (entries.length === 0) {
      await ctx.reply('📋 Сегодня ты еще не добавлял еду.');
      return;
    }

    let historyText = '📋 <b>Приемы пищи сегодня:</b>\n\n';
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    // Group by meal type
    const meals = {
      breakfast: [] as any[],
      lunch: [] as any[],
      dinner: [] as any[],
      snack: [] as any[],
    };

    entries.forEach(entry => {
      meals[entry.meal_type].push(entry);
      const food = entry.food_data;
      totalCalories += food.calories;
      totalProtein += food.protein;
      totalFat += food.fat;
      totalCarbs += food.carbs;
    });

    // Display each meal type
    Object.entries(meals).forEach(([mealType, mealEntries]) => {
      if (mealEntries.length > 0) {
        historyText += `\n<b>${getMealTypeText(mealType as MealType)}:</b>\n`;
        mealEntries.forEach(entry => {
          const food = entry.food_data;
          historyText += `• ${food.name} (${food.weight}г) - ${formatCalories(food.calories)}\n`;
        });
      }
    });

    historyText += `\n<b>Итого за день:</b>\n`;
    historyText += `${formatCalories(totalCalories)} | ${formatMacros({ protein: totalProtein, fat: totalFat, carbs: totalCarbs })}`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🍎 Добавить еду', callback_data: 'add_food' }],
          [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
          [{ text: '🔙 Назад', callback_data: 'main_menu' }],
        ],
      },
    };

    await ctx.replyWithHTML(historyText, keyboard);

  } catch (error) {
    console.error('Error showing food history:', error);
    await ctx.reply('❌ Не удалось загрузить историю питания.');
  }
}

// Import the function we need
import { getFoodEntriesByDate } from '../database/queries';
