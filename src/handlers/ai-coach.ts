import { Context } from 'telegraf';
import { getAICoachResponse } from '../utils/openai';
import { addChatMessage, getChatHistory } from '../database/queries';
import type { CustomContext } from '../types';

/**
 * Handle AI coach messages
 */
export async function handleAICoachMessage(ctx: CustomContext, message: string): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    if (!message || message.trim().length < 2) {
      await ctx.reply('Пожалуйста, задай вопрос или напиши что-то более подробно.');
      return;
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Save user message to database
    await addChatMessage({
      user_id: ctx.user.id,
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    });

    // Get chat history for context
    const chatHistory = await getChatHistory(ctx.user.id, 10);

    // Get AI response
    const aiResponse = await getAICoachResponse(message.trim(), ctx.user, chatHistory);

    // Save AI response to database
    await addChatMessage({
      user_id: ctx.user.id,
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    });

    // Send response with action buttons
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Дашборд', callback_data: 'dashboard' },
            { text: '🍎 Добавить еду', callback_data: 'add_food' },
          ],
          [
            { text: '💧 Добавить воду', callback_data: 'add_water' },
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.reply(aiResponse, keyboard);

  } catch (error) {
    console.error('Error handling AI coach message:', error);
    await ctx.reply(
      'Извини, у меня сейчас технические проблемы. Попробуй задать вопрос позже или используй другие функции бота.'
    );
  }
}

/**
 * Start AI coach conversation
 */
export async function startAICoach(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const welcomeMessage = `
🤖 <b>Привет! Я твой AI-коуч по питанию и здоровью!</b>

Я помогу тебе с:
🍎 Вопросами о питании и диете
💪 Советами по тренировкам
🏃‍♂️ Мотивацией и поддержкой
📊 Анализом твоих данных
🧠 Любыми вопросами о здоровье

Я знаю твой профиль и могу давать персональные рекомендации!

Просто напиши свой вопрос или расскажи о своих целях.
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💡 Популярные вопросы', callback_data: 'ai_questions' },
          ],
          [
            { text: '📊 Мой дашборд', callback_data: 'dashboard' },
            { text: '🍎 Добавить еду', callback_data: 'add_food' },
          ],
          [
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(welcomeMessage, keyboard);
    ctx.currentStep = 'ai_coach';

  } catch (error) {
    console.error('Error starting AI coach:', error);
    await ctx.reply('❌ Не удалось запустить AI-коуча.');
  }
}

/**
 * Show popular questions for AI coach
 */
export async function showPopularQuestions(ctx: CustomContext): Promise<void> {
  const questionsText = `
💡 <b>Популярные вопросы:</b>

<b>О питании:</b>
• "Как правильно завтракать?"
• "Что есть перед тренировкой?"
• "Сколько белка мне нужно?"
• "Как ускорить метаболизм?"

<b>О похудении:</b>
• "Как создать дефицит калорий?"
• "Какие продукты помогают похудеть?"
• "Как не сорваться с диеты?"
• "Почему вес стоит на месте?"

<b>О наборе веса:</b>
• "Как набрать мышечную массу?"
• "Что есть после тренировки?"
• "Как увеличить аппетит?"
• "Какие добавки принимать?"

<b>Общие вопросы:</b>
• "Как начать правильно питаться?"
• "Сколько воды нужно пить?"
• "Как составить план питания?"
• "Что делать если переел?"

Просто скопируй любой вопрос или задай свой!
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 Начать диалог', callback_data: 'ai_coach' }],
        [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    },
  };

  await ctx.replyWithHTML(questionsText, keyboard);
}

/**
 * Show AI coach tips
 */
export async function showAITips(ctx: CustomContext): Promise<void> {
  const tipsText = `
💡 <b>Советы по использованию AI-коуча:</b>

<b>Задавай конкретные вопросы:</b>
✅ "Как рассчитать мою норму белка?"
❌ "Расскажи про белок"

<b>Указывай контекст:</b>
✅ "Я тренируюсь 3 раза в неделю, как питаться?"
❌ "Как питаться?"

<b>Проси персональные советы:</b>
✅ "Учитывая мой вес 70кг, сколько калорий мне нужно?"
❌ "Сколько калорий нужно?"

<b>Задавай практические вопросы:</b>
• "Что приготовить на ужин?"
• "Как перекусить в офисе?"
• "Что взять в спортзал?"

<b>Помни:</b> Я знаю твой профиль и могу давать персональные рекомендации!
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 Задать вопрос', callback_data: 'ai_coach' }],
        [{ text: '💡 Популярные вопросы', callback_data: 'ai_questions' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    },
  };

  await ctx.replyWithHTML(tipsText, keyboard);
}
