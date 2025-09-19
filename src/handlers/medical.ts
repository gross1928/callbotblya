import { Context } from 'telegraf';
import { addMedicalData, getMedicalDataByUser } from '../database/queries';
import { analyzeMedicalData } from '../utils/openai';
import type { CustomContext, MedicalData } from '../types';

/**
 * Show medical data menu
 */
export async function showMedicalMenu(ctx: CustomContext): Promise<void> {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 Загрузить анализы', callback_data: 'upload_medical' }],
        [{ text: '📊 Просмотр данных', callback_data: 'view_medical' }],
        [{ text: '📋 История анализов', callback_data: 'medical_history' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    },
  };

  await ctx.reply('🧪 <b>Медицинские данные</b>\n\nЗдесь ты можешь загружать и анализировать свои медицинские анализы.', keyboard);
}

/**
 * Handle document upload for medical data
 */
export async function handleMedicalDocumentUpload(ctx: CustomContext): Promise<void> {
  await ctx.reply(
    '📄 <b>Загрузка медицинских данных</b>\n\n' +
    'Поддерживаемые форматы:\n' +
    '• PDF файлы с анализами\n' +
    '• Фото анализов (JPG, PNG)\n' +
    '• Текстовые описания результатов\n\n' +
    'Просто отправь файл или опиши результаты анализов текстом.\n\n' +
    'Пример: "Общий анализ крови: гемоглобин 140 г/л, эритроциты 4.5 млн/мкл"'
  );
  
  ctx.currentStep = 'medical_upload';
}

/**
 * Handle medical text input
 */
export async function handleMedicalTextInput(ctx: CustomContext, text: string): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    await ctx.reply('🔍 Анализирую медицинские данные...');

    // Parse the text to extract medical data
    const medicalData = parseMedicalText(text);
    
    if (!medicalData) {
      await ctx.reply('❌ Не удалось распознать медицинские данные. Попробуй описать более подробно.');
      return;
    }

    // Analyze using AI
    const analysis = await analyzeMedicalData(
      medicalData.type,
      medicalData.data,
      ctx.user
    );

    // Save to database
    const entry = {
      user_id: ctx.user.id,
      type: medicalData.type as any,
      date: medicalData.date || new Date().toISOString().split('T')[0],
      data: medicalData.data,
      analysis: analysis.analysis,
      recommendations: analysis.recommendations,
    };

    await addMedicalData(entry);

    const resultText = `
🧪 <b>Анализ медицинских данных</b>

<b>Тип анализа:</b> ${getMedicalTypeText(medicalData.type)}
<b>Дата:</b> ${entry.date}

<b>📊 Анализ:</b>
${analysis.analysis}

<b>💡 Рекомендации:</b>
${analysis.recommendations}

⚠️ <i>Помни: это только общий анализ. Для точной диагностики обратись к врачу!</i>
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Все анализы', callback_data: 'view_medical' },
            { text: '📄 Загрузить еще', callback_data: 'upload_medical' },
          ],
          [
            { text: '🤖 AI-коуч', callback_data: 'ai_coach' },
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(resultText, keyboard);

    ctx.currentStep = undefined;

  } catch (error) {
    console.error('Error processing medical text:', error);
    await ctx.reply('❌ Не удалось проанализировать медицинские данные. Попробуй еще раз или обратись к врачу.');
    ctx.currentStep = undefined;
  }
}

/**
 * Show medical data history
 */
export async function showMedicalHistory(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const medicalData = await getMedicalDataByUser(ctx.user.id);

    if (medicalData.length === 0) {
      await ctx.reply('📋 У тебя пока нет загруженных медицинских данных.');
      return;
    }

    let historyText = '📋 <b>История медицинских данных:</b>\n\n';

    medicalData.forEach((entry, index) => {
      const date = new Date(entry.date).toLocaleDateString('ru-RU');
      historyText += `${index + 1}. <b>${getMedicalTypeText(entry.type)}</b> - ${date}\n`;
      
      if (entry.analysis) {
        const shortAnalysis = entry.analysis.length > 100 
          ? entry.analysis.substring(0, 100) + '...'
          : entry.analysis;
        historyText += `   ${shortAnalysis}\n`;
      }
      historyText += '\n';
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 Загрузить новые', callback_data: 'upload_medical' },
            { text: '📊 Просмотр данных', callback_data: 'view_medical' },
          ],
          [
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(historyText, keyboard);

  } catch (error) {
    console.error('Error showing medical history:', error);
    await ctx.reply('❌ Не удалось загрузить историю медицинских данных.');
  }
}

/**
 * Show detailed medical data
 */
export async function showMedicalData(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    const medicalData = await getMedicalDataByUser(ctx.user.id);

    if (medicalData.length === 0) {
      await ctx.reply('📋 У тебя пока нет загруженных медицинских данных.');
      return;
    }

    // Show the most recent entry
    const latestEntry = medicalData[0];
    const date = new Date(latestEntry.date).toLocaleDateString('ru-RU');

    const dataText = `
🧪 <b>${getMedicalTypeText(latestEntry.type)}</b>
📅 ${date}

<b>📊 Данные:</b>
${JSON.stringify(latestEntry.data, null, 2)}

${latestEntry.analysis ? `\n<b>🔍 Анализ:</b>\n${latestEntry.analysis}` : ''}

${latestEntry.recommendations ? `\n<b>💡 Рекомендации:</b>\n${latestEntry.recommendations}` : ''}
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 История', callback_data: 'medical_history' },
            { text: '📄 Загрузить новые', callback_data: 'upload_medical' },
          ],
          [
            { text: '🤖 AI-коуч', callback_data: 'ai_coach' },
            { text: '🔙 Главное меню', callback_data: 'main_menu' },
          ],
        ],
      },
    };

    await ctx.replyWithHTML(dataText, keyboard);

  } catch (error) {
    console.error('Error showing medical data:', error);
    await ctx.reply('❌ Не удалось загрузить медицинские данные.');
  }
}

/**
 * Parse medical text to extract structured data
 */
function parseMedicalText(text: string): { type: string; date?: string; data: any } | null {
  const lowerText = text.toLowerCase();

  // Determine type based on keywords
  let type = 'other';
  if (lowerText.includes('кров') || lowerText.includes('гемоглобин') || lowerText.includes('эритроцит')) {
    type = 'blood';
  } else if (lowerText.includes('гормон') || lowerText.includes('тиреотропный') || lowerText.includes('тестостерон')) {
    type = 'hormones';
  } else if (lowerText.includes('моча') || lowerText.includes('урина') || lowerText.includes('белок в моче')) {
    type = 'urine';
  }

  // Extract date if present
  const dateMatch = text.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  const date = dateMatch ? dateMatch[1] : undefined;

  // For now, store the raw text as data
  // In a real implementation, you would parse specific values
  const data = {
    raw_text: text,
    extracted_values: extractMedicalValues(text),
  };

  return { type, date, data };
}

/**
 * Extract medical values from text
 */
function extractMedicalValues(text: string): Record<string, any> {
  const values: Record<string, any> = {};
  
  // Simple regex patterns for common medical values
  const patterns = [
    { key: 'hemoglobin', pattern: /гемоглобин[:\s]*(\d+\.?\d*)\s*г\/л/i },
    { key: 'erythrocytes', pattern: /эритроциты[:\s]*(\d+\.?\d*)\s*млн\/мкл/i },
    { key: 'leukocytes', pattern: /лейкоциты[:\s]*(\d+\.?\d*)\s*тыс\/мкл/i },
    { key: 'platelets', pattern: /тромбоциты[:\s]*(\d+\.?\d*)\s*тыс\/мкл/i },
    { key: 'glucose', pattern: /глюкоза[:\s]*(\d+\.?\d*)\s*ммоль\/л/i },
    { key: 'cholesterol', pattern: /холестерин[:\s]*(\d+\.?\d*)\s*ммоль\/л/i },
  ];

  patterns.forEach(({ key, pattern }) => {
    const match = text.match(pattern);
    if (match) {
      values[key] = parseFloat(match[1]);
    }
  });

  return values;
}

/**
 * Get medical type text in Russian
 */
function getMedicalTypeText(type: string): string {
  const types = {
    blood: 'Общий анализ крови',
    hormones: 'Анализ на гормоны',
    urine: 'Общий анализ мочи',
    other: 'Другие анализы',
  };
  return types[type as keyof typeof types] || 'Неизвестный тип';
}
