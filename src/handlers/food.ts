import { Context } from 'telegraf';
import { analyzeFoodFromPhoto, analyzeFoodFromText } from '../utils/openai';
import { addFoodEntry, saveUserSession, getUserSession, clearUserSession } from '../database/queries';
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
    
    console.log(`[handleFoodPhotoAnalysis] Analysis completed:`, analysis);
    
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
    
    console.log(`[handleFoodTextAnalysis] Analysis completed:`, analysis);
    
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
  try {
    // Generate unique ID for this analysis
    const analysisId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[showFoodAnalysis] Starting with analysisId: ${analysisId}`);
    console.log(`[showFoodAnalysis] Analysis data:`, JSON.stringify(analysis));
    console.log(`[showFoodAnalysis] ctx.foodAnalyses size before:`, ctx.foodAnalyses?.size || 0);
    console.log(`[showFoodAnalysis] ctx.tempData keys before:`, ctx.tempData ? Object.keys(ctx.tempData) : 'undefined');
    
    // Store analysis in context and database
    if (ctx.foodAnalyses) {
      ctx.foodAnalyses.set(analysisId, analysis);
      console.log(`[showFoodAnalysis] Added to ctx.foodAnalyses`);
    } else {
      console.error(`[showFoodAnalysis] ctx.foodAnalyses is null!`);
    }
    
    // Also save to database for persistence across messages
    try {
      // Load existing session data to preserve other data
      const existingSession = await getUserSession(ctx.from!.id);
      console.log(`[showFoodAnalysis] Existing session loaded:`, existingSession);
      
      const tempData = existingSession?.tempData || {};
      tempData[analysisId] = analysis;
      
      // Update ctx.tempData to keep it in sync
      if (!ctx.tempData) {
        ctx.tempData = {};
        console.log(`[showFoodAnalysis] Initialized ctx.tempData`);
      }
      ctx.tempData[analysisId] = analysis;
      
      console.log(`[showFoodAnalysis] Saving analysis with ID: ${analysisId} to database`);
      console.log(`[showFoodAnalysis] tempData keys before save:`, Object.keys(tempData));
      console.log(`[showFoodAnalysis] ctx.tempData keys after update:`, Object.keys(ctx.tempData));
      
      // Don't set currentStep to avoid interfering with other operations
      console.log(`[showFoodAnalysis] About to call saveUserSession`);
      await saveUserSession(ctx.from!.id, existingSession?.currentStep, tempData);
      console.log(`[showFoodAnalysis] Analysis saved successfully to database`);
      
      // Verify the save worked
      const verifySession = await getUserSession(ctx.from!.id);
      console.log(`[showFoodAnalysis] Verification - session after save:`, {
        currentStep: verifySession?.currentStep,
        tempDataKeys: verifySession?.tempData ? Object.keys(verifySession.tempData) : 'undefined'
      });
      
    } catch (error) {
      console.error('Error saving food analysis to database:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }

    console.log(`[showFoodAnalysis] About to create analysis text and keyboard`);

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

    console.log(`[showFoodAnalysis] Analysis text created successfully`);

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

    console.log(`[showFoodAnalysis] Keyboard created successfully`);

    await ctx.replyWithHTML(analysisText, keyboard);
    console.log(`[showFoodAnalysis] Message sent successfully`);
    
  } catch (error) {
    console.error(`[showFoodAnalysis] Error in showFoodAnalysis:`, error);
    await ctx.reply('❌ Произошла ошибка при отображении анализа еды. Попробуй еще раз.');
  }
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

    console.log(`[saveFoodEntryById] Attempting to save analysis with ID: ${analysisId}`);
    console.log(`[saveFoodEntryById] ctx.foodAnalyses:`, ctx.foodAnalyses);
    console.log(`[saveFoodEntryById] ctx.tempData:`, ctx.tempData);

    // Get analysis from context or database
    let analysis = null;
    
    // First try to get from context
    if (ctx.foodAnalyses && ctx.foodAnalyses.has(analysisId)) {
      analysis = ctx.foodAnalyses.get(analysisId);
      console.log(`[saveFoodEntryById] Found analysis in ctx.foodAnalyses`);
    }
    // If not in context, try to get from tempData
    else if (ctx.tempData && ctx.tempData[analysisId]) {
      analysis = ctx.tempData[analysisId];
      console.log(`[saveFoodEntryById] Found analysis in ctx.tempData`);
    }
    // If still not found, try to reload from database
    else {
      console.log(`[saveFoodEntryById] Analysis not found in context, trying to reload from database`);
      const session = await getUserSession(ctx.from!.id);
      if (session?.tempData && session.tempData[analysisId]) {
        analysis = session.tempData[analysisId];
        console.log(`[saveFoodEntryById] Found analysis in database session`);
        
        // Update context to keep it in sync
        if (!ctx.tempData) {
          ctx.tempData = {};
        }
        ctx.tempData[analysisId] = analysis;
        
        if (!ctx.foodAnalyses) {
          ctx.foodAnalyses = new Map();
        }
        ctx.foodAnalyses.set(analysisId, analysis);
      }
    }
    
    if (!analysis) {
      console.error(`[saveFoodEntryById] Analysis not found for ID: ${analysisId}`);
      console.error(`[saveFoodEntryById] Available keys in ctx.tempData:`, ctx.tempData ? Object.keys(ctx.tempData) : 'tempData is null');
      console.error(`[saveFoodEntryById] Available keys in ctx.foodAnalyses:`, ctx.foodAnalyses ? Array.from(ctx.foodAnalyses.keys()) : 'foodAnalyses is null');
      await ctx.reply('❌ Анализ еды не найден. Попробуй еще раз.');
      return;
    }

    console.log(`[saveFoodEntryById] Found analysis:`, analysis);

    const entry = {
      user_id: ctx.user.id,
      meal_type: mealType,
      food_data: analysis,
      timestamp: new Date().toISOString(),
    };

    await addFoodEntry(entry);

    // Clean up analysis from context
    if (ctx.foodAnalyses) {
      ctx.foodAnalyses.delete(analysisId);
    }
    if (ctx.tempData && ctx.tempData[analysisId]) {
      delete ctx.tempData[analysisId];
    }
    
    // Clear entire session from database after successful save
    await clearUserSession(ctx.from!.id);
    console.log(`[saveFoodEntryById] Session cleared after successful save`);

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

    // Clear session from database after successful save
    await clearUserSession(ctx.from!.id);
    console.log(`[saveFoodEntry] Session cleared after successful save`);

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
    // Get analysis from context or database
    let analysis = null;
    
    // First try to get from context
    if (ctx.foodAnalyses && ctx.foodAnalyses.has(analysisId)) {
      analysis = ctx.foodAnalyses.get(analysisId);
    }
    // If not in context, try to get from database
    else if (ctx.tempData && ctx.tempData[analysisId]) {
      analysis = ctx.tempData[analysisId];
    }
    
    if (!analysis) {
      await ctx.reply('❌ Анализ еды не найден. Попробуй еще раз.');
      return;
    }

    await handleFoodEdit(ctx, analysis, analysisId);
  } catch (error) {
    console.error('Error editing food:', error);
    await ctx.reply('❌ Ошибка при редактировании еды');
  }
}

export async function handleFoodEdit(ctx: CustomContext, analysis: FoodAnalysis, analysisId: string): Promise<void> {
  try {
    // Save analysis ID and data to session for text handler
    const session = await getUserSession(ctx.from!.id);
    const tempData = session?.tempData || {};
    tempData[analysisId] = analysis;
    tempData['editing_analysis_id'] = analysisId; // Store which analysis we're editing
    
    const currentStep = `edit_food_${analysisId}`;
    await saveUserSession(ctx.from!.id, currentStep, tempData);
    
    console.log(`[handleFoodEdit] Set editing mode for analysis ${analysisId}`);
    
    const currentInfo = `
✏️ <b>Редактирование блюда</b>

<b>Текущее блюдо:</b> ${analysis.name}
<b>Вес:</b> ${analysis.weight}г
<b>Ингредиенты:</b> ${analysis.ingredients.join(', ')}

<b>Текущие КБЖУ:</b>
• Калории: ${analysis.calories} ккал
• Белки: ${analysis.protein}г | Жиры: ${analysis.fat}г | Углеводы: ${analysis.carbs}г

<b>Что хочешь добавить или изменить?</b>

Например:
• "добавь 10г масла"
• "еще 50г риса"
• "убери банан"
• "жареное на масле"

Напиши дополнения к блюду:
    `;
    
    await ctx.reply(currentInfo, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('[handleFoodEdit] Error:', error);
    await ctx.reply('❌ Ошибка при редактировании');
  }
}

/**
 * Handle food edit text input
 */
export async function handleFoodEditText(ctx: CustomContext, text: string, analysisId: string): Promise<void> {
  try {
    console.log(`[handleFoodEditText] Editing analysis ${analysisId} with text: ${text}`);
    
    // Get original analysis
    const session = await getUserSession(ctx.from!.id);
    const analysis = session?.tempData?.[analysisId];
    
    if (!analysis) {
      await ctx.reply('❌ Анализ не найден. Попробуй заново добавить еду.');
      await clearUserSession(ctx.from!.id);
      return;
    }
    
    await ctx.reply('🔍 Анализирую изменения...');
    
    // Determine if this is a correction or an addition based on user's text
    const lowerText = text.toLowerCase();
    const isCorrectionKeywords = ['не ', 'нет', 'ошиб', 'неправильно', 'на самом деле', 'это '];
    const isCorrection = isCorrectionKeywords.some(keyword => lowerText.includes(keyword));
    
    let updatedDescription: string;
    
    if (isCorrection) {
      // If user is correcting the recognition, use only their text with a clear instruction
      updatedDescription = `Исходный анализ был неверным. Правильное описание: ${text}`;
      console.log(`[handleFoodEditText] Detected correction. New description: ${updatedDescription}`);
    } else {
      // If user is adding to the meal, combine with original
      const originalDescription = `${analysis.name} ${analysis.weight}г (${analysis.ingredients.join(', ')})`;
      updatedDescription = `${originalDescription}. Дополнительно: ${text}`;
      console.log(`[handleFoodEditText] Detected addition. Original: ${originalDescription}, Updated: ${updatedDescription}`);
    }
    
    // Re-analyze with updated description
    const updatedAnalysis = await analyzeFoodFromText(updatedDescription);
    
    console.log(`[handleFoodEditText] Updated analysis:`, updatedAnalysis);
    
    // Show updated analysis with same flow as original
    await showFoodAnalysis(ctx, updatedAnalysis);
    
    // Clear editing session
    await clearUserSession(ctx.from!.id);
    ctx.currentStep = undefined;
    
  } catch (error) {
    console.error('[handleFoodEditText] Error:', error);
    await ctx.reply('❌ Не удалось обработать изменения. Попробуй еще раз или добавь блюдо заново.');
    await clearUserSession(ctx.from!.id);
  }
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
