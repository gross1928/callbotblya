import { Telegraf, Context } from 'telegraf';
import { config, validateConfig } from '../config';
import { getUserByTelegramId, getUserSession, saveUserSession, clearUserSession } from '../database/queries';
import { getUserProduct } from '../database/products-queries';
import { handleProfileStep, handleGenderCallback, handleActivityCallback, handleGoalCallback } from '../handlers/profile';
import { handleFoodPhotoAnalysis, handleFoodTextAnalysis, saveFoodEntry, saveFoodEntryById, handleFoodEdit, handleFoodEditById, showFoodHistory } from '../handlers/food';
import { showDashboard, showNutritionBreakdown } from '../handlers/dashboard';
import { addWater, showWaterMenu, showWaterHistory } from '../handlers/water';
import { handleAICoachMessage, startAICoach, showPopularQuestions, showAITips } from '../handlers/ai-coach';
import { showMedicalMenu, handleMedicalDocumentUpload, handleMedicalTextInput, showMedicalHistory, showMedicalData, handleMedicalPhotoAnalysis } from '../handlers/medical';
import {
  showUserProductsMenu,
  showProductDetails,
  handleAddProductStart,
  handleAddProductName,
  handleAddProductComplete,
  handleDeleteProduct,
  parseKBZHU,
  createFoodAnalysisFromProduct,
} from '../handlers/products';
import { editOrReply } from '../utils/telegram';
import type { BotContext } from '../types';

// Extend Telegraf context with our custom properties
interface CustomContext extends Context {
  user?: any;
  isNewUser: boolean;
  currentStep?: string;
  tempData?: Record<string, any>;
  foodAnalyses?: Map<string, any>;
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
    console.log(`[Middleware] RAW session object:`, JSON.stringify(session, null, 2));
    console.log(`[Middleware] Loaded session for ${telegramId}:`, {
      currentStep: session?.currentStep,
      tempDataKeys: session?.tempData ? Object.keys(session.tempData) : 'undefined',
      tempDataType: typeof session?.tempData,
      tempDataIsNull: session?.tempData === null,
      tempDataIsUndefined: session?.tempData === undefined
    });
    if (session) {
      ctx.currentStep = session.currentStep;
      ctx.tempData = session.tempData || {};
      console.log(`[Middleware] Session found, tempData keys:`, Object.keys(ctx.tempData || {}));
      console.log(`[Middleware] Session found, tempData:`, JSON.stringify(ctx.tempData));
    } else {
      ctx.currentStep = undefined;
      ctx.tempData = {};
      console.log(`[Middleware] No session found, initialized empty tempData`);
    }
    console.log(`[Middleware] ctx.tempData keys after loading:`, Object.keys(ctx.tempData || {}));
    
    // Initialize food analyses storage and load from database
    ctx.foodAnalyses = new Map();
    if (ctx.tempData) {
      // Load food analyses from tempData
      const tempDataEntries = Object.entries(ctx.tempData);
      console.log(`[Middleware] tempData entries count:`, tempDataEntries.length);
      for (const [key, value] of tempDataEntries) {
        console.log(`[Middleware] Processing tempData key:`, key, `starts with food_:`, key.startsWith('food_'));
        if (key.startsWith('food_')) {
          ctx.foodAnalyses.set(key, value);
          console.log(`[Middleware] Loaded food analysis ${key} into ctx.foodAnalyses`);
        }
      }
    }
    console.log(`[Middleware] ctx.foodAnalyses size:`, ctx.foodAnalyses.size);
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
  
  await clearUserSession(ctx.from!.id);
  ctx.currentStep = undefined;
  await showDashboard(ctx);
});

// Food tracking command
bot.command('food', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await clearUserSession(ctx.from!.id);
  ctx.currentStep = undefined;
  await showFoodMenu(ctx);
});

// Water tracking command
bot.command('water', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await clearUserSession(ctx.from!.id);
  ctx.currentStep = undefined;
  await showWaterMenu(ctx);
});

// AI Coach command
bot.command('coach', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  // AI coach will set its own step
  await startAICoach(ctx);
});

// Medical data command
bot.command('medical', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }
  
  await clearUserSession(ctx.from!.id);
  ctx.currentStep = undefined;
  await showMedicalMenu(ctx);
});

// Help command
bot.help(async (ctx: CustomContext) => {
  const helpText = `
🍎 <b>ДаЕда - Помощник по питанию</b>

<b>Как пользоваться:</b>
1. Нажми <b>Главное меню</b> (кнопка ниже) или /start
2. Выбери нужное действие из меню
3. Следуй инструкциям бота

<b>Основные функции:</b>
📊 <b>Дашборд</b> - твой прогресс за сегодня
🍎 <b>Добавить еду</b> - фото или описание
💧 <b>Добавить воду</b> - отслеживание водного баланса
🤖 <b>AI-коуч</b> - персональные советы по питанию
🧪 <b>Медицинские данные</b> - храни и анализируй анализы
👤 <b>Профиль</b> - твои данные и цели

<b>Поддерживаемые форматы:</b>
📷 Фото еды для анализа
📄 PDF медицинских анализов
💬 Текстовые описания еды

<b>Нужна помощь?</b>
Если что-то не работает или есть предложения, пиши:
👤 @grossvn
  `;

  await ctx.replyWithHTML(helpText);
});

// Handle photo uploads for food analysis
bot.on('photo', async (ctx: CustomContext) => {
  if (ctx.isNewUser) {
    await ctx.reply('Сначала создай профиль командой /profile');
    return;
  }

  // Check if user is uploading medical data
  if (ctx.currentStep === 'medical_upload') {
    await handleMedicalPhotoAnalysis(ctx);
    return;
  }

  // Check if user is in food photo mode
  if (ctx.currentStep === 'food_photo') {
    await handleFoodPhotoInput(ctx);
  } else {
    await handleFoodPhotoAnalysis(ctx);
  }
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
  
  const text = (ctx.message as any)?.text || '';

  // Handle products reply keyboard buttons
  if (text === '➕ Добавить продукт') {
    try {
      const { text: responseText, keyboard } = await handleAddProductStart();
      ctx.currentStep = 'add_product_name';
      ctx.tempData = {};
      await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
      await ctx.reply(responseText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error starting add product:', error);
      await ctx.reply('❌ Ошибка при добавлении продукта');
    }
    return;
  }

  if (text === '◀️ Назад к добавлению еды') {
    await clearUserSession(ctx.from!.id);
    ctx.currentStep = undefined;
    await showFoodMenu(ctx);
    return;
  }

  if (text === '◀️ К моим продуктам') {
    await clearUserSession(ctx.from!.id);
    ctx.currentStep = undefined;
    try {
      const { text: menuText, keyboard } = await showUserProductsMenu(ctx.from!.id, 0);
      await ctx.reply(menuText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error showing products menu:', error);
      await ctx.reply('❌ Ошибка при загрузке продуктов');
    }
    return;
  }

  // Handle pagination buttons
  if (text === '⬅️' || text === '➡️') {
    // Get current page from context (if stored) or assume 0
    const currentPage = ctx.tempData?.productsPage || 0;
    const newPage = text === '⬅️' ? Math.max(0, currentPage - 1) : currentPage + 1;
    
    try {
      const { text: menuText, keyboard } = await showUserProductsMenu(ctx.from!.id, newPage);
      ctx.tempData = { ...ctx.tempData, productsPage: newPage };
      await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
      await ctx.reply(menuText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error changing products page:', error);
      await ctx.reply('❌ Ошибка при загрузке продуктов');
    }
    return;
  }

  // Handle product selection from reply keyboard (buttons like "🍽 Сыр")
  if (text.startsWith('🍽 ')) {
    const productName = text.replace('🍽 ', '');
    
    try {
      // Find product by name
      const { getUserProductsPaginated } = await import('../database/products-queries');
      const { products } = await getUserProductsPaginated(ctx.from!.id, 0, 100);
      const product = products.find(p => p.name === productName);
      
      if (product) {
        const { text: detailText, keyboard } = await showProductDetails(ctx.from!.id, product.id);
        ctx.currentStep = `product_weight_${product.id}`;
        ctx.tempData = { productId: product.id };
        await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
        await ctx.reply(detailText, { parse_mode: 'HTML', ...keyboard });
      } else {
        await ctx.reply('❌ Продукт не найден');
      }
    } catch (error) {
      console.error('Error handling product selection:', error);
      await ctx.reply('❌ Ошибка при выборе продукта');
    }
    return;
  }
  
  // If user is in registration process, handle profile step
  if (ctx.currentStep && (ctx.currentStep.startsWith('name') || 
      ctx.currentStep === 'age' || 
      ctx.currentStep === 'height' || 
      ctx.currentStep === 'weight' || 
      ctx.currentStep === 'target_weight' || 
      ctx.currentStep === 'target_date')) {
    await handleProfileStep(ctx, text);
    return;
  }

  // Handle add product - name input
  if (ctx.currentStep === 'add_product_name') {
    const text = (ctx.message as any)?.text || '';
    if (text === '❌ Отмена') {
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await ctx.reply('❌ Добавление продукта отменено');
      return;
    }
    try {
      const { text: responseText, keyboard } = await handleAddProductName(text);
      ctx.currentStep = 'add_product_kbzhu';
      ctx.tempData = { productName: text };
      await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
      await ctx.reply(responseText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error handling product name:', error);
      await ctx.reply('❌ Ошибка при добавлении продукта');
    }
    return;
  }

  // Handle add product - KBZHU input
  if (ctx.currentStep === 'add_product_kbzhu') {
    const text = (ctx.message as any)?.text || '';
    if (text === '❌ Отмена') {
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await ctx.reply('❌ Добавление продукта отменено');
      return;
    }

    const kbzhu = parseKBZHU(text);
    if (!kbzhu) {
      await ctx.reply(
        '❌ Неверный формат!\n\n' +
        'Введи КБЖУ в формате:\n' +
        '<code>калории\nбелки\nжиры\nуглеводы</code>\n\n' +
        'Пример:\n' +
        '<code>220\n13\n5\n21</code>',
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      const productName = ctx.tempData?.productName || 'Неизвестный продукт';
      const { text: responseText, keyboard } = await handleAddProductComplete(
        ctx.from!.id,
        productName,
        kbzhu
      );
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await ctx.reply(responseText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error completing add product:', error);
      await ctx.reply('❌ Ошибка при сохранении продукта');
    }
    return;
  }

  // Handle product weight input
  if (ctx.currentStep?.startsWith('product_weight_')) {
    const text = (ctx.message as any)?.text || '';
    
    // Handle quick weight buttons
    let weightGrams = 0;
    if (text.match(/^\d+г$/)) {
      weightGrams = parseInt(text.replace('г', ''));
    } else if (text === '◀️ К моим продуктам') {
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      const { text: menuText, keyboard } = await showUserProductsMenu(ctx.from!.id, 0);
      await ctx.reply(menuText, { parse_mode: 'HTML', ...keyboard });
      return;
    } else if (text === '❌ Удалить продукт') {
      const productId = ctx.tempData?.productId;
      if (productId) {
        try {
          await handleDeleteProduct(ctx.from!.id, productId);
          await ctx.reply('✅ Продукт удален!');
          const { text: menuText, keyboard } = await showUserProductsMenu(ctx.from!.id, 0);
          await ctx.reply(menuText, { parse_mode: 'HTML', ...keyboard });
        } catch (error) {
          await ctx.reply('❌ Ошибка при удалении продукта');
        }
      }
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      return;
    } else {
      weightGrams = parseInt(text);
    }

    if (!weightGrams || weightGrams <= 0) {
      await ctx.reply('❌ Введи корректный вес в граммах (например: 150)');
      return;
    }

    const productId = ctx.tempData?.productId;
    if (!productId) {
      await ctx.reply('❌ Ошибка: продукт не найден');
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      return;
    }

    try {
      const product = await getUserProduct(ctx.from!.id, productId);
      if (!product) {
        await ctx.reply('❌ Продукт не найден');
        await clearUserSession(ctx.from!.id);
        ctx.currentStep = undefined;
        return;
      }

      const foodAnalysis = createFoodAnalysisFromProduct(product, weightGrams);
      
      // Save to session like regular food analysis
      const analysisId = `product_${Date.now()}`;
      ctx.tempData = { ...ctx.tempData, [analysisId]: foodAnalysis };
      await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
      
      // Show meal type selection
      const analysisText = `
🍎 <b>Продукт добавлен</b>

<b>Блюдо:</b> ${foodAnalysis.name}
<b>Вес:</b> ${foodAnalysis.weight}г

<b>КБЖУ:</b>
• Калории: ${foodAnalysis.calories} ккал
• Белки: ${foodAnalysis.protein}г | Жиры: ${foodAnalysis.fat}г | Углеводы: ${foodAnalysis.carbs}г

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
              { text: '🍿 Перекус', callback_data: `save_food_snack_${analysisId}` },
            ],
            [
              { text: '✏️ Редактировать', callback_data: `edit_food_${analysisId}` },
            ],
            [
              { text: '❌ Отмена', callback_data: 'cancel_food' },
            ],
          ],
        },
      };

      await ctx.reply(analysisText, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error handling product weight:', error);
      await ctx.reply('❌ Ошибка при обработке веса продукта');
    }
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

  // Handle all other text messages as AI coach questions
  // (when no specific step is active)
  if (!ctx.currentStep) {
    const text = (ctx.message as any)?.text || '';
    if (text && text.trim().length > 0) {
      console.log('[Text Handler] Forwarding message to AI coach:', text.substring(0, 50));
      await handleAICoachMessageWrapper(ctx, text);
      return;
    }
  }

  // If we get here, unknown message type
  console.log('[Text Handler] Unknown message type, currentStep:', ctx.currentStep);
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

  await editOrReply(ctx, '<b>Выбери действие:</b>', keyboard);
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

🎯 <b>Твои цели на день:</b>
• Калории: ${profile.target_calories} ккал
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

  await editOrReply(ctx, text, keyboard);
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
        [{ text: '📦 Продукты', callback_data: 'user_products' }],
        [{ text: '📋 История приемов пищи', callback_data: 'food_history' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }],
      ],
    },
  };

  await editOrReply(ctx, '<b>🍎 Выбери способ добавления еды:</b>', keyboard);
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
  // Don't clear session here! We need the tempData for when user clicks meal type button
  // Session will be cleared after successful save in saveFoodEntryById
}

// Handle food photo input
async function handleFoodPhotoInput(ctx: CustomContext): Promise<void> {
  await handleFoodPhotoAnalysis(ctx);
  // Don't clear session here! We need the tempData for when user clicks meal type button
  // Session will be cleared after successful save in saveFoodEntryById
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
    const analysisId = parts.slice(3).join('_');
    try {
      await saveFoodEntryById(ctx, mealType, analysisId);
    } catch (error) {
      await ctx.reply('❌ Ошибка при сохранении еды');
    }
    return;
  }

  // Handle food editing
  if (data.startsWith('edit_food_')) {
    const analysisId = data.replace('edit_food_', '');
    try {
      await handleFoodEditById(ctx, analysisId);
    } catch (error) {
      await ctx.reply('❌ Ошибка при редактировании еды');
    }
    return;
  }

  // Handle cancel food
  if (data === 'cancel_food') {
    await clearUserSession(ctx.from!.id);
    await ctx.reply('❌ Добавление еды отменено');
    ctx.currentStep = undefined;
    return;
  }

  // Handle food history
  if (data === 'food_history') {
    await clearUserSession(ctx.from!.id);
    ctx.currentStep = undefined;
    await showFoodHistory(ctx);
    return;
  }

  // Handle user products
  if (data === 'user_products' || data.startsWith('products_page_')) {
    const page = data.startsWith('products_page_') ? parseInt(data.split('_')[2]) : 0;
    await clearUserSession(ctx.from!.id);
    ctx.currentStep = undefined;
    try {
      const { text, keyboard } = await showUserProductsMenu(ctx.from!.id, page);
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error showing products menu:', error);
      await ctx.reply('❌ Ошибка при загрузке продуктов');
    }
    return;
  }

  // Handle product selection
  if (data.startsWith('product_')) {
    const productId = parseInt(data.split('_')[1]);
    try {
      const { text, keyboard } = await showProductDetails(ctx.from!.id, productId);
      ctx.currentStep = `product_weight_${productId}`;
      ctx.tempData = { productId };
      await saveUserSession(ctx.from!.id, ctx.currentStep, ctx.tempData);
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error showing product details:', error);
      await ctx.reply('❌ Ошибка при загрузке продукта');
    }
    return;
  }

  // Handle delete product
  if (data.startsWith('delete_product_')) {
    const productId = parseInt(data.split('_')[2]);
    try {
      await handleDeleteProduct(ctx.from!.id, productId);
      await ctx.reply('✅ Продукт удален!');
      const { text, keyboard } = await showUserProductsMenu(ctx.from!.id, 0);
      await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      console.error('Error deleting product:', error);
      await ctx.reply('❌ Ошибка при удалении продукта');
    }
    return;
  }

  switch (data) {
    case 'main_menu':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showMainMenu(ctx);
      break;
    case 'dashboard':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showDashboardHandler(ctx);
      break;
    case 'add_food':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showFoodMenu(ctx);
      break;
    case 'add_water':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showWaterMenuHandler(ctx);
      break;
    case 'ai_coach':
      // AI coach will set its own step
      await startAICoachHandler(ctx);
      break;
    case 'medical':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showMedicalMenuHandler(ctx);
      break;
    case 'profile':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showProfile(ctx);
      break;
    case 'edit_profile':
      await startProfileRegistration(ctx);
      break;
    case 'food_photo':
      await ctx.reply('📷 Отправь фото еды для анализа');
      ctx.currentStep = 'food_photo';
      await saveUserSession(ctx.from!.id, 'food_photo', {});
      break;
    case 'food_text':
      await ctx.reply('✍️ Опиши что ты съел (например: "Овсянка 100г с бананом")');
      ctx.currentStep = 'food_text';
      await saveUserSession(ctx.from!.id, 'food_text', {});
      break;
    case 'water_100':
    case 'water_250':
    case 'water_500':
    case 'water_750':
      const amount = parseInt(data.split('_')[1]);
      await addWater(ctx, amount);
      break;
    case 'water_history':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showWaterHistory(ctx);
      break;
    case 'ai_questions':
      // Keep AI coach mode active
      await showPopularQuestions(ctx);
      break;
    case 'upload_medical':
      await handleMedicalDocumentUpload(ctx);
      break;
    case 'view_medical':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
      await showMedicalData(ctx);
      break;
    case 'medical_history':
      await clearUserSession(ctx.from!.id);
      ctx.currentStep = undefined;
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
    
    // Set menu button to show main menu
    try {
      await bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'commands',
        },
      });
      console.log('✅ Menu button configured');
    } catch (error) {
      console.error('⚠️ Failed to set menu button:', error);
    }
    
    // Set bot commands for menu
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🏠 Главное меню' },
        { command: 'help', description: '❓ Помощь' },
      ]);
      console.log('✅ Bot commands set');
    } catch (error) {
      console.error('⚠️ Failed to set bot commands:', error);
    }
    
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
