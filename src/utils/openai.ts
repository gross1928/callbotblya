import OpenAI from 'openai';
import { config } from '../config';
import type { FoodAnalysis } from '../types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Analyze food from photo using Vision API
 */
export async function analyzeFoodFromPhoto(imageUrl: string): Promise<FoodAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Проанализируй это фото еды и определи:
1. Название блюда
2. Ингредиенты (список через запятую)
3. Примерный вес порции в граммах
4. Общие калории всего блюда (не на 100г!)
5. Общие белки всего блюда в граммах (не на 100г!)
6. Общие жиры всего блюда в граммах (не на 100г!)
7. Общие углеводы всего блюда в граммах (не на 100г!)

ВАЖНО: Считай КБЖУ для ВСЕГО блюда, а не на 100г!

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "weight": вес_в_граммах,
  "total_calories": общие_калории_всего_блюда,
  "total_protein": общие_белки_всего_блюда_в_граммах,
  "total_fat": общие_жиры_всего_блюда_в_граммах,
  "total_carbs": общие_углеводы_всего_блюда_в_граммах
}`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: config.openai.maxTokens,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[analyzeFoodFromPhoto] OpenAI response:', content);

    // Try to extract JSON from response (in case there's extra text)
    let jsonContent = content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[analyzeFoodFromPhoto] Failed to parse JSON:', content);
      throw new Error('OpenAI не вернул данные в формате JSON. Попробуй другое фото или опиши блюдо текстом.');
    }
    
    // Use total values directly (no need to multiply)
    const weight = analysis.weight || 100;

    return {
      name: analysis.name || 'Неизвестное блюдо',
      ingredients: analysis.ingredients || [],
      weight: weight,
      calories: Math.round(analysis.total_calories || 0),
      protein: Math.round((analysis.total_protein || 0) * 10) / 10,
      fat: Math.round((analysis.total_fat || 0) * 10) / 10,
      carbs: Math.round((analysis.total_carbs || 0) * 10) / 10,
    };

  } catch (error) {
    console.error('Error analyzing food from photo:', error);
    throw new Error('Не удалось проанализировать фото. Попробуй еще раз или опиши блюдо текстом.');
  }
}

/**
 * Analyze food from text description
 */
export async function analyzeFoodFromText(description: string): Promise<FoodAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Ты эксперт по питанию. Анализируй описание еды и определи КБЖУ.
Отвечай только в формате JSON без дополнительного текста.`
        },
        {
          role: 'user',
          content: `Проанализируй это описание еды: "${description}"

Определи:
1. Название блюда
2. Ингредиенты (список через запятую)
3. Примерный вес порции в граммах
4. Общие калории всего блюда (не на 100г!)
5. Общие белки всего блюда в граммах (не на 100г!)
6. Общие жиры всего блюда в граммах (не на 100г!)
7. Общие углеводы всего блюда в граммах (не на 100г!)

ВАЖНО: Считай КБЖУ для ВСЕГО блюда, а не на 100г!

Ответь в формате JSON:
{
  "name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "weight": вес_в_граммах,
  "total_calories": общие_калории_всего_блюда,
  "total_protein": общие_белки_всего_блюда_в_граммах,
  "total_fat": общие_жиры_всего_блюда_в_граммах,
  "total_carbs": общие_углеводы_всего_блюда_в_граммах
}`
        }
      ],
      max_tokens: config.openai.maxTokens,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[analyzeFoodFromText] OpenAI response:', content);

    // Try to extract JSON from response (in case there's extra text)
    let jsonContent = content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[analyzeFoodFromText] Failed to parse JSON:', content);
      throw new Error('Не удалось распознать формат ответа. Попробуй быть более конкретным (например: "Овсянка 100г с бананом 150г")');
    }
    
    // Use total values directly (no need to multiply)
    const weight = analysis.weight || 100;

    return {
      name: analysis.name || 'Неизвестное блюдо',
      ingredients: analysis.ingredients || [],
      weight: weight,
      calories: Math.round(analysis.total_calories || 0),
      protein: Math.round((analysis.total_protein || 0) * 10) / 10,
      fat: Math.round((analysis.total_fat || 0) * 10) / 10,
      carbs: Math.round((analysis.total_carbs || 0) * 10) / 10,
    };

  } catch (error) {
    console.error('Error analyzing food from text:', error);
    if (error instanceof Error && error.message.includes('распознать формат')) {
      throw error;
    }
    throw new Error('Не удалось проанализировать описание. Попробуй быть более конкретным (например: "Овсянка 100г с бананом 150г")');
  }
}

/**
 * Get AI coach response
 */
export async function getAICoachResponse(
  userMessage: string, 
  userProfile?: any, 
  chatHistory?: Array<{role: string, content: string}>
): Promise<string> {
  try {
    const systemPrompt = `Ты персональный AI-коуч по питанию и здоровью. 
Твоя задача - помогать пользователям с вопросами о питании, тренировках, здоровье и мотивацией.

Правила:
- Отвечай на русском языке
- Будь дружелюбным и поддерживающим
- Давай конкретные и практичные советы
- Учитывай профиль пользователя если он предоставлен
- Если не знаешь ответа, честно скажи об этом
- Не давай медицинские диагнозы, только общие рекомендации
- ВАЖНО: Используй HTML теги для форматирования: <b>жирный текст</b> вместо **текст**
- НЕ используй markdown звездочки **, используй только HTML теги <b></b>
- Ответ должен быть кратким и не превышать 2000 символов
- НЕ начинай ответ с приветствий ("Привет", "Здравствуй" и т.д.) - сразу отвечай на вопрос
- Это продолжение диалога, а не первое сообщение

${userProfile ? `Профиль пользователя:
- Имя: ${userProfile.name}
- Возраст: ${userProfile.age} лет
- Пол: ${userProfile.gender}
- Рост: ${userProfile.height} см
- Вес: ${userProfile.weight} кг
- Активность: ${userProfile.activity_level}
- Цель: ${userProfile.goal}
- Целевые калории: ${userProfile.target_calories} ккал
- Целевые БЖУ: Б${userProfile.target_protein}г Ж${userProfile.target_fat}г У${userProfile.target_carbs}г
` : ''}`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add chat history if provided
    if (chatHistory && chatHistory.length > 0) {
      // Limit history to last 10 messages to avoid token limits
      const recentHistory = chatHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      max_tokens: 600, // Increased to allow for ~2000 characters in Russian
      temperature: 0.7,
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Convert markdown to HTML formatting
    // Replace **text** with <b>text</b>
    content = content.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    
    // Replace *text* with <i>text</i> (if any)
    content = content.replace(/\*([^*]+)\*/g, '<i>$1</i>');

    // Telegram has a 4096 character limit, but we limit to 2048 for better UX
    const maxLength = 2048;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength - 50) + '...\n\n<i>Ответ слишком длинный, попробуй задать более конкретный вопрос.</i>';
    }

    return content;

  } catch (error) {
    console.error('Error getting AI coach response:', error);
    throw new Error('Извини, у меня сейчас технические проблемы. Попробуй задать вопрос позже.');
  }
}

/**
 * Analyze medical data (blood tests, etc.)
 */
export async function analyzeMedicalData(
  dataType: string,
  data: any,
  userProfile?: any
): Promise<{ analysis: string; recommendations: string }> {
  try {
    const systemPrompt = `Ты врач-аналитик. Анализируй медицинские данные и давай рекомендации.
Правила:
- Отвечай на русском языке
- Будь профессиональным но понятным
- Указывай только общие рекомендации, не стави диагнозы
- Рекомендуй обратиться к врачу при отклонениях
- Учитывай профиль пользователя если предоставлен`;

    const userPrompt = `Проанализируй ${dataType} данные:
${JSON.stringify(data, null, 2)}

${userProfile ? `Профиль пациента: ${userProfile.name}, ${userProfile.age} лет, ${userProfile.gender}, вес ${userProfile.weight}кг` : ''}

Дай анализ результатов и рекомендации.`;

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Split analysis and recommendations
    const parts = content.split('\n\n');
    return {
      analysis: parts[0] || content,
      recommendations: parts[1] || 'Рекомендуется консультация с врачом для детального анализа.'
    };

  } catch (error) {
    console.error('Error analyzing medical data:', error);
    throw new Error('Не удалось проанализировать медицинские данные. Попробуй еще раз или обратись к врачу.');
  }
}