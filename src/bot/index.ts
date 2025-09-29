import { Telegraf, Context } from 'telegraf';
import { config, validateConfig } from '../config';
import { getUserByTelegramId, getUserSession, saveUserSession, clearUserSession } from '../database/queries';
import { handleProfileStep, handleGenderCallback, handleActivityCallback, handleGoalCallback } from '../handlers/profile';
import { handleFoodPhotoAnalysis, handleFoodTextAnalysis, saveFoodEntry, handleFoodEdit, showFoodHistory } from '../handlers/food';
import { showDashboard, showNutritionBreakdown } from '../handlers/dashboard';
import { addWater, showWaterMenu, showWaterHistory } from '../handlers/water';
import { handleAICoachMessage, startAICoach, showPopularQuestions, showAITips } from '../handlers/ai-coach';
import { showMedicalMenu, handleMedicalDocumentUpload, handleMedicalTextInput, showMedicalHistory, showMedicalData } from '../handlers/medical';
import type { BotContext } from '../types';

// Extend Telegraf context with our custom properties
interface CustomContext extends Context {
  user?: any;
  isNewUser: boolean;
  currentStep?: string;
  tempData?: Record<string, any>;
}

// Create bot instance
const bot = new Telegraf<CustomContext>(config.telegram.token);

// Middleware to load user data and session
bot.use(async (ctx: CustomContext, next: () => Promise<void>) => {
  const telegramId = ctx.from?.id;
  
  if (!telegramId) {
    return next();
  }

  try {
    // Load user profile
    const user = await getUserByTelegramId(telegramId);
    ctx.user = user || undefined;
    ctx.isNewUser = !user;
    
    // Load session state from database
    const session = await getUserSession(telegramId);
    if (session) {
      ctx.currentStep = session.currentStep;
      ctx.tempData = session.tempData || {};
    } else {
      ctx.currentStep = undefined;
      ctx.tempData = {};
    }
  } catch (error) {
    console.error('Error loading user and session:', error);
    ctx.currentStep = undefined;
    ctx.tempData = {};
  }

  return next();
});

// Start command
bot.start(async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply(
      '🍎 Добро пожаловать в бота "ДаЕда"!\n\n' +
      'Я помогу тебе отслеживать питание, калории, воду и медицинские данные.\n\n' +
      'Для начала нужно создать профиль. Нажми /profile чтобы начать регистрацию.'
    );
  } else {
    await showMainMenu(ctx);
  }
});

// Profile command
bot.command('profile', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await startProfileRegistration(ctx);
  } else {
    await showProfile(ctx);
  }
});

// Dashboard command
bot.command('dashboard', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await showDashboard(ctx);
});

// Food tracking command
bot.command('food', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await showFoodMenu(ctx);
});

// Water tracking command
bot.command('water', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await showWaterMenu(ctx);
});

// AI Coach command
bot.command('coach', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await startAICoach(ctx);
});

// Medical data command
bot.command('medical', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await showMedicalMenu(ctx);
});

// Help command
bot.help(async (ctx: CustomContext) => {
  const helpText = `
🍎 <b>ДаЕда - Помощник по питанию</b>

<b>Основные команды:</b>
/profile - Создать или посмотреть профиль
/dashboard - Дашборд с данными за сегодня
/food - Добавить еду (фото или текст)
/water - Добавить воду
/coach - AI-коуч для вопросов о питании
/medical - Медицинские данные и анализы
/help - Эта справка

<b>Как пользоваться:</b>
1. Создай профиль командой /profile
2. Добавляй еду через /food (фото или описание)
3. Отслеживай воду через /water
4. Смотри прогресс в /dashboard
5. Задавай вопросы AI-коучу через /coach

<b>Поддерживаемые форматы:</b>
📷 Фото еды для анализа
📄 PDF анализов
💬 Текстовые описания еды
  `;

  await ctx.replyWithHTML(helpText);
});

// Handle photo uploads for food analysis
bot.on('photo', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }

  await handleFoodPhoto(ctx);
});

// Handle document uploads (for medical data)
bot.on('document', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }

  await handleDocumentUpload(ctx);
});

// Handle text messages during registration
bot.on('text', async (ctx: CustomContext) => {
  console.log('Text message received:', { 
    currentStep: ctx.currentStep, 
    hasTempData: !!ctx.tempData,
    text: (ctx.message as any)?.text?.substring(0, 50) 
  });
  
  // If user is in registration process, handle profile step
  if (ctx.currentStep && (ctx.currentStep.startsWith('name') || 
      ctx.currentStep === 'age' || 
      ctx.currentStep === 'height' || 
      ctx.currentStep === 'weight' || 
      ctx.currentStep === 'target_weight' || 
      ctx.currentStep === 'target_date')) {
    const text = (ctx.message as any)?.text || '';
    await handleProfileStep(ctx, text);
    return;
  }

  // Handle AI coach messages
  if (ctx.currentStep === 'ai_coach') {
    const text = (ctx.message as any)?.text || '';
    await handleAICoachMessageWrapper(ctx, text);
    return;
  }

  // Handle food text input
  if (ctx.currentStep === 'food_text') {
    const text = (ctx.message as any)?.text || '';
    await handleFoodTextInput(ctx, text);
    return;
  }

  // Handle medical text input
  if (ctx.currentStep === 'medical_upload') {
    const text = (ctx.message as any)?.text || '';
    await handleMedicalTextInput(ctx, text);
    return;
  }
});

// Handle callback queries (button presses)
bot.on('callback_query', async (ctx: CustomContext) => {
  const callbackData = (ctx.callbackQuery as any)?.data;
  
  if (!callbackData) return;

  try {
    await handleCallbackQuery(ctx, callbackData);
  } catch (error) {
    console.error('Error handling callback query:', error);
    await ctx.answerCbQuery('Произошла ошибка. Попробуй еще раз.');
  }
});

// Placeholder functions (to be implemented)
async function showMainMenu(ctx: CustomContext) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
        [{ text: '🍎 Добавить еду', callback_data: 'add_food' }],
        [{ text: '💧 Добавить воду', callback_data: 'add_water' }],
        [{ text: '🤖 AI-коуч', callback_data: 'ai_coach' }],
        [{ text: '🧪 Медицинские данные', callback_data: 'medical' }],
        [{ text: '👤 Профиль', callback_data: 'profile' }],
      ],
    },
  };

  await ctx.reply('Выбери действие:', keyboard);
}

async function startProfileRegistration(ctx: CustomContext) {
  await ctx.reply(
    '👤 Давай создадим твой профиль!\n\n' +
    'Для расчета твоих потребностей в калориях мне нужна следующая информация:\n\n' +
    'Начнем с имени. Как тебя зовут?'
  );
  
  ctx.currentStep = 'name';
  ctx.tempData = {};
  
  // Save session to database
  await saveUserSession(ctx.from!.id, 'name', {});
}

async function showProfile(ctx: CustomContext) {
  if (!ctx.user) return;
  
  const profile = ctx.user;
  const text = `
👤 <b>Твой профиль</b>

<b>Имя:</b> ${profile.name}
<b>Возраст:</b> ${profile.age} лет
<b>Пол:</b> ${profile.gender === 'male' ? 'Мужской' : 'Женский'}
<b>Рост:</b> ${profile.height} см
<b>Вес:</b> ${profile.weight} кг
<b>Активность:</b> ${getActivityLevelText(profile.activity_level)}
<b>Цель:</b> ${getGoalText(profile.goal)}

<b>Расчеты:</b>
• BMR: ${profile.bmr} ккал
• TDEE: ${profile.tdee} ккал
• Целевые калории: ${profile.target_calories} ккал
• Белки: ${profile.target_protein}г | Жиры: ${profile.target_fat}г | Углеводы: ${profile.target_carbs}г
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Изменить профиль', callback_data: 'edit_profile' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ],
    },
  };

  await ctx.replyWithHTML(text, keyboard);
}

async function showDashboardHandler(ctx: CustomContext) {
  await showDashboard(ctx);
}

async function showFoodMenu(ctx: CustomContext) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📷 Фото еды', callback_data: 'food_photo' }],
        [{ text: '✍️ Текстовое описание', callback_data: 'food_text' }],
        [{ text: '📋 История приемов пищи', callback_data: 'food_history' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ],
    },
  };

  await ctx.reply('🍎 Выбери способ добавления еды:', keyboard);
}

async function showWaterMenuHandler(ctx: CustomContext) {
  await showWaterMenu(ctx);
}

async function startAICoachHandler(ctx: CustomContext) {
  await startAICoach(ctx);
}

async function showMedicalMenuHandler(ctx: CustomContext) {
  await showMedicalMenu(ctx);
}

async function handleFoodPhoto(ctx: CustomContext) {
  await handleFoodPhotoAnalysis(ctx);
}

async function handleDocumentUpload(ctx: CustomContext) {
  await ctx.reply('📄 Обрабатываю документ... (функция в разработке)');
}

// Handle AI coach messages
async function handleAICoachMessageWrapper(ctx: CustomContext, message: string): Promise<void> {
  await handleAICoachMessage(ctx, message);
}

// Handle food text input
async function handleFoodTextInput(ctx: CustomContext, text: string): Promise<void> {
  await handleFoodTextAnalysis(ctx, text);
  ctx.currentStep = undefined;
}

async function handleCallbackQuery(ctx: CustomContext, data: string) {
  await ctx.answerCbQuery();

  // Handle profile registration callbacks
  if (data.startsWith('gender_')) {
    const gender = data.split('_')[1] as 'male' | 'female';
    await handleGenderCallback(ctx, gender);
    return;
  }

  if (data.startsWith('activity_')) {
    const activityKey = data.split('_')[1];
    await handleActivityCallback(ctx, activityKey);
    return;
  }

  if (data.startsWith('goal_')) {
    const goalKey = data.split('_')[1];
    await handleGoalCallback(ctx, goalKey);
    return;
  }

  // Handle food saving callbacks
  if (data.startsWith('save_food_')) {
    const parts = data.split('_');
    const mealType = parts[2] as any;
    const analysisJson = parts.slice(3).join('_');
    try {
      const analysis = JSON.parse(analysisJson);
      await saveFoodEntry(ctx, mealType, analysis);
    } catch (error) {
      await ctx.reply('❌ Ошибка при сохранении еды');
    }
    return;
  }

  // Handle food editing
  if (data.startsWith('edit_food_')) {
    const analysisJson = data.replace('edit_food_', '');
    try {
      const analysis = JSON.parse(analysisJson);
      await handleFoodEdit(ctx, analysis);
    } catch (error) {
      await ctx.reply('❌ Ошибка при редактировании еды');
    }
    return;
  }

  // Handle cancel food
  if (data === 'cancel_food') {
    await ctx.reply('❌ Добавление еды отменено');
    ctx.currentStep = undefined;
    return;
  }

  // Handle food history
  if (data === 'food_history') {
    await showFoodHistory(ctx);
    return;
  }

  switch (data) {
    case 'main_menu':
      await showMainMenu(ctx);
      break;
    case 'dashboard':
      await showDashboardHandler(ctx);
      break;
    case 'add_food':
      await showFoodMenu(ctx);
      break;
    case 'add_water':
      await showWaterMenuHandler(ctx);
      break;
    case 'ai_coach':
      await startAICoachHandler(ctx);
      break;
    case 'medical':
      await showMedicalMenuHandler(ctx);
      break;
    case 'profile':
      await showProfile(ctx);
      break;
    case 'food_photo':
      await ctx.reply('📷 Отправь фото еды для анализа');
      ctx.currentStep = 'food_photo';
      break;
    case 'food_text':
      await ctx.reply('✍️ Опиши что ты съел (например: "Овсянка 100г с бананом")');
      ctx.currentStep = 'food_text';
      break;
    case 'water_100':
    case 'water_250':
    case 'water_500':
    case 'water_750':
      const amount = parseInt(data.split('_')[1]);
      await addWater(ctx, amount);
      break;
    case 'water_history':
      await showWaterHistory(ctx);
      break;
    case 'ai_questions':
      await showPopularQuestions(ctx);
      break;
    case 'upload_medical':
      await handleMedicalDocumentUpload(ctx);
      break;
    case 'view_medical':
      await showMedicalData(ctx);
      break;
    case 'medical_history':
      await showMedicalHistory(ctx);
      break;
    default:
      await ctx.reply('Команда не распознана');
  }
}

// Helper functions
function getActivityLevelText(level: string): string {
  const levels = {
    sedentary: 'Малоподвижный',
    light: 'Легкая активность',
    moderate: 'Умеренная активность',
    active: 'Высокая активность',
    very_active: 'Очень высокая активность',
  };
  return levels[level as keyof typeof levels] || level;
}

function getGoalText(goal: string): string {
  const goals = {
    lose: 'Похудение',
    maintain: 'Поддержание веса',
    gain: 'Набор веса',
  };
  return goals[goal as keyof typeof goals] || goal;
}

// Error handling
bot.catch((err: any, ctx: CustomContext) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка. Попробуй еще раз или обратись к администратору.');
});

// Export bot instance
export { bot };

// Start function
export async function startBot(): Promise<void> {
  try {
    validateConfig();
    console.log('🤖 Запуск бота "ДаЕда"...');
    
    // Stop any existing webhook and use polling
    await bot.telegram.deleteWebhook();
    console.log('Webhook deleted, starting polling...');
    
    // Use polling mode for Railway deployment
    await bot.launch({
      dropPendingUpdates: true, // Drop pending updates to avoid conflicts
    });
    console.log('Bot started with polling');

    console.log('✅ Бот успешно запущен!');
  } catch (error) {
    console.error('❌ Ошибка запуска бота:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
