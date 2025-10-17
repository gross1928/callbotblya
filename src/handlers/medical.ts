import { Context } from 'telegraf';
import { addMedicalData, getMedicalDataByUser, clearUserSession, saveUserSession } from '../database/queries';
import { analyzeMedicalData, analyzeMedicalPhoto } from '../utils/openai';
import { editOrReply } from '../utils/telegram';
import type { CustomContext, MedicalData } from '../types';

/**
 * Show medical data menu
 */
export async function showMedicalMenu(ctx: CustomContext): Promise<void> {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 Загрузить анализы', callback_data: 'upload_medical' }],
        [{ text: '📋 История анализов', callback_data: 'medical_history' }],
        [{ text: '🔙 Главное меню', callback_data: 'main_menu' }],
      ],
    },
  };

  await editOrReply(ctx, '🧪 <b>Медицинские данные</b>\n\nЗдесь ты можешь загружать и анализировать свои медицинские анализы.', keyboard);
}

/**
 * Handle medical photo analysis
 */
export async function handleMedicalPhotoAnalysis(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    if (!ctx.message || !('photo' in ctx.message)) {
      await ctx.reply('Пожалуйста, отправь фото медицинского анализа.');
      return;
    }

    await ctx.reply('📊 Анализирую фото медицинского анализа...');

    // Get the largest photo
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    
    // Get file URL from Telegram
    const file = await ctx.telegram.getFile(largestPhoto.file_id);
    const imageUrl = `https://api.telegram.org/file/bot${ctx.telegram.token}/${file.file_path}`;

    // Analyze medical photo
    const result = await analyzeMedicalPhoto(imageUrl);

    console.log('[handleMedicalPhotoAnalysis] Analysis result:', result.text);

    // Determine analysis type from result
    let analysisType = 'other';
    const lowerText = result.text.toLowerCase();
    if (lowerText.includes('кров')) analysisType = 'blood';
    else if (lowerText.includes('моч')) analysisType = 'urine';
    else if (lowerText.includes('гормон')) analysisType = 'hormones';

    // Save to database
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await addMedicalData({
        user_id: ctx.user.id,
        type: analysisType as 'blood' | 'hormones' | 'urine' | 'other',
        date: today,
        data: { 
          source: 'photo',
          extracted_text: result.text,
          raw_data: result.data 
        },
        analysis: result.text,
        recommendations: undefined
      });

      console.log('[handleMedicalPhotoAnalysis] Medical data saved to database');
    } catch (saveError) {
      console.error('[handleMedicalPhotoAnalysis] Error saving to database:', saveError);
      // Continue to show results even if save fails
    }

    // Show extracted data
    await ctx.replyWithHTML(
      `📋 <b>Распознанные данные из анализа:</b>\n\n${result.text}\n\n` +
      `<i>✅ Данные сохранены в базу. Проверь правильность и при необходимости скорректируй в разделе "Просмотр данных".</i>`
    );

    // Clear step and session
    ctx.currentStep = undefined;
    await clearUserSession(ctx.from!.id);

  } catch (error) {
    console.error('Error analyzing medical photo:', error);
    await ctx.reply('❌ Не удалось проанализировать фото. Попробуй еще раз или опиши результаты текстом.');
  }
}

/**
 * Handle medical document analysis (images sent as documents for better quality)
 */
export async function handleMedicalDocumentAnalysis(ctx: CustomContext): Promise<void> {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Пользователь не найден');
      return;
    }

    if (!ctx.message || !('document' in ctx.message)) {
      await ctx.reply('Пожалуйста, отправь документ с медицинским анализом.');
      return;
    }

    const document = ctx.message.document;
    const mimeType = document.mime_type || '';
    const fileName = document.file_name || '';

    console.log('[handleMedicalDocumentAnalysis] Received document:', {
      mime_type: mimeType,
      file_name: fileName,
      file_size: document.file_size
    });

    // Check if it's HEIC format (not supported by OpenAI)
    const isHEIC = mimeType === 'image/heic' || 
                   mimeType === 'image/heif' ||
                   /\.(heic|heif)$/i.test(fileName);

    if (isHEIC) {
      await ctx.reply(
        '⚠️ Формат HEIC (фото iPhone) не поддерживается при отправке документом.\n\n' +
        '✅ <b>Решение:</b>\n' +
        'Отправь это же фото как <b>обычное фото</b> (не документом) - ' +
        'Telegram автоматически конвертирует его в поддерживаемый формат и качество сохранится достаточным для распознавания.\n\n' +
        'Или сделай скриншот и отправь скриншот.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Check if it's an image file
    const isImage = mimeType.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);

    if (!isImage) {
      await ctx.reply(
        '❌ Этот формат пока не поддерживается.\n\n' +
        'Поддерживаемые форматы:\n' +
        '• Изображения (JPG, PNG, WebP)\n\n' +
        'Для PDF файлов - сделай скриншот страницы с результатами и отправь как изображение.'
      );
      return;
    }

    await ctx.reply('📊 Анализирую документ с медицинским анализом...');

    // Get file URL from Telegram
    const file = await ctx.telegram.getFile(document.file_id);
    const imageUrl = `https://api.telegram.org/file/bot${ctx.telegram.token}/${file.file_path}`;

    console.log('[handleMedicalDocumentAnalysis] Image URL:', imageUrl);

    // Analyze medical photo (same as photo handler)
    const result = await analyzeMedicalPhoto(imageUrl);

    console.log('[handleMedicalDocumentAnalysis] Analysis result:', result.text);

    // Determine analysis type from result
    let analysisType = 'other';
    const lowerText = result.text.toLowerCase();
    if (lowerText.includes('кров')) analysisType = 'blood';
    else if (lowerText.includes('моч')) analysisType = 'urine';
    else if (lowerText.includes('гормон')) analysisType = 'hormones';

    // Save to database
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await addMedicalData({
        user_id: ctx.user.id,
        type: analysisType as 'blood' | 'hormones' | 'urine' | 'other',
        date: today,
        data: { 
          source: 'document',
          file_name: fileName,
          mime_type: mimeType,
          extracted_text: result.text,
          raw_data: result.data 
        },
        analysis: result.text,
        recommendations: undefined
      });

      console.log('[handleMedicalDocumentAnalysis] Medical data saved to database');
    } catch (saveError) {
      console.error('[handleMedicalDocumentAnalysis] Error saving to database:', saveError);
      // Continue to show results even if save fails
    }

    // Show extracted data
    await ctx.replyWithHTML(
      `📋 <b>Распознанные данные из анализа:</b>\n\n${result.text}\n\n` +
      `<i>✅ Данные сохранены в базу. Проверь правильность и при необходимости скорректируй в разделе "Просмотр данных".</i>`
    );

    // Clear step and session
    ctx.currentStep = undefined;
    await clearUserSession(ctx.from!.id);

  } catch (error) {
    console.error('Error analyzing medical document:', error);
    await ctx.reply('❌ Не удалось проанализировать документ. Попробуй еще раз или опиши результаты текстом.');
  }
}

/**
 * Handle document upload for medical data
 */
export async function handleMedicalDocumentUpload(ctx: CustomContext): Promise<void> {
  await ctx.replyWithHTML(
    '📄 <b>Загрузка медицинских данных</b>\n\n' +
    '<b>Поддерживаемые форматы:</b>\n' +
    '• 📷 Фото анализов (обычное фото)\n' +
    '• 📎 Документы: JPG, PNG, WebP\n' +
    '• ✍️ Текстовые описания результатов\n\n' +
    '<b>💡 Важно для iPhone:</b>\n' +
    'Если ты хочешь сохранить качество - отправляй как <b>обычное фото</b> (не документом), ' +
    'Telegram конвертирует HEIC в JPG автоматически.\n\n' +
    'Или просто <b>опиши результаты анализов текстом</b>.\n\n' +
    '<i>Пример: "Общий анализ крови: гемоглобин 140 г/л, эритроциты 4.5 млн/мкл"</i>'
  );
  
  ctx.currentStep = 'medical_upload';
  await saveUserSession(ctx.from!.id, 'medical_upload', {});
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
            { text: '📄 Загрузить еще', callback_data: 'upload_medical' },
            { text: '📋 История', callback_data: 'medical_history' },
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

    // Limit text length to avoid Telegram's 4096 character limit
    const maxLength = 3800; // Leave some room for formatting
    let analysisText = latestEntry.analysis || '';
    let dataJsonText = JSON.stringify(latestEntry.data, null, 2);
    
    // If analysis is too long, truncate it
    if (analysisText.length > 2000) {
      analysisText = analysisText.substring(0, 2000) + '\n\n... (текст обрезан, слишком длинный)';
    }
    
    // If data JSON is too long, truncate it
    if (dataJsonText.length > 500) {
      dataJsonText = dataJsonText.substring(0, 500) + '\n... (данные обрезаны)';
    }

    let dataText = `
🧪 <b>${getMedicalTypeText(latestEntry.type)}</b>
📅 ${date}

<b>📊 Данные:</b>
${dataJsonText}

${analysisText ? `\n<b>🔍 Анализ:</b>\n${analysisText}` : ''}

${latestEntry.recommendations ? `\n<b>💡 Рекомендации:</b>\n${latestEntry.recommendations}` : ''}
    `;
    
    // Final safety check - ensure message is not too long
    if (dataText.length > maxLength) {
      dataText = dataText.substring(0, maxLength) + '\n\n... (сообщение обрезано)';
    }

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
    
    // Report error to Telegram notifications
    const { captureException } = await import('../utils/sentry');
    captureException(error as Error, {
      user: ctx.user,
      context: 'show_medical_data',
      telegramId: ctx.from?.id,
    });
    
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
