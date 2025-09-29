import { Context } from 'telegraf';
import { analyzeFoodFromPhoto, analyzeFoodFromText } from '../utils/openai';
import { addFoodEntry } from '../database/queries';
import { formatCalories, formatMacros } from '../utils/calculations';
import { updateDashboardMessage } from './dashboard';
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
  // Generate unique ID for this analysis
  const analysisId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store analysis in context
  if (ctx.foodAnalyses) {
    ctx.foodAnalyses.set(analysisId, analysis);
  }

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
          { text: '🌅 Завтрак', callback_data: `save_food_breakfast_${analysisId}` },
          { text: '🌞 Обед', callback_data: `save_food_lunch_${analysisId}` },
        ],
        [
          { text: '🌙 Ужин', callback_data: `save_food_dinner_${analysisId}` },
          { text: '🍪 Перекус', callback_data: `save_food_snack_${analysisId}` },
        ],
        [
          { text: '✏️ Изменить', callback_data: `edit_food_${analysisId}` },
          { text: '❌ Отмена', callback_data: 'cancel_food' },
        ],
      ],
    },
  };

  await ctx.replyWithHTML(analysisText, keyboard);
}

/**
 * Save food entry to database by analysis ID
 */
export async function saveFoodEntryById(ctx: CustomContext, mealType: MealType, analysisId: string): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    // Get analysis from context
    if (!ctx.foodAnalyses || !ctx.foodAnalyses.has(analysisId)) {
      await ctx.reply('❌ Анализ еды не найден. Попробуй еще раз.');
      return;
    }

    const analysis = ctx.foodAnalyses.get(analysisId);

    const entry = {
      user_id: ctx.user.id,
      meal_type: mealType,
      food_data: analysis,
      timestamp: new Date().toISOString(),
    };

    await addFoodEntry(entry);

    // Clean up analysis from context
    ctx.foodAnalyses.delete(analysisId);

    // Update dashboard instead of showing success message
    await updateDashboardMessage(ctx);
    
    // Show quick confirmation
    await ctx.answerCbQuery(`✅ ${getMealTypeText(mealType)} добавлен!`);

  } catch (error) {
    console.error('Error saving food entry:', error);
    await ctx.reply('❌ Не удалось сохранить прием пищи. Попробуй еще раз.');
  }
}

/**
 * Save food entry to database (legacy function)
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

    // Update dashboard instead of showing success message
    await updateDashboardMessage(ctx);
    
    // Show quick confirmation
    await ctx.answerCbQuery(`✅ ${getMealTypeText(mealType)} добавлен!`);

  } catch (error) {
    console.error('Error saving food entry:', error);
    await ctx.reply('❌ Не удалось сохранить прием пищи. Попробуй еще раз.');
  }
}

/**
 * Handle food editing
 */
/**
 * Handle food editing by analysis ID
 */
export async function handleFoodEditById(ctx: CustomContext, analysisId: string): Promise<void> {
  try {
    if (!ctx.foodAnalyses || !ctx.foodAnalyses.has(analysisId)) {
      await ctx.reply('❌ Анализ еды не найден. Попробуй еще раз.');
      return;
    }

    const analysis = ctx.foodAnalyses.get(analysisId);
    await handleFoodEdit(ctx, analysis);
  } catch (error) {
    console.error('Error editing food:', error);
    await ctx.reply('❌ Ошибка при редактировании еды');
  }
}

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
