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
    console.log('[analyzeFoodFromText] Input description:', description);
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Ты эксперт по питанию. Анализируй описание еды и определи КБЖУ.
ВАЖНО: Отвечай СТРОГО в формате JSON. НЕ добавляй никакого текста до или после JSON.
Если описание слишком расплывчатое, все равно дай примерную оценку.`
        },
        {
          role: 'user',
          content: `Проанализируй это описание еды: "${description}"

Определи:
1. Название блюда (если неясно - придумай похожее название)
2. Ингредиенты (список, даже если приблизительный)
3. Примерный вес порции в граммах (если не указан - оцени стандартную порцию)
4. Общие калории всего блюда (не на 100г!)
5. Общие белки всего блюда в граммах (не на 100г!)
6. Общие жиры всего блюда в граммах (не на 100г!)
7. Общие углеводы всего блюда в граммах (не на 100г!)

ВАЖНО: 
- Считай КБЖУ для ВСЕГО блюда, а не на 100г!
- Даже если описание неточное, дай примерную оценку
- Отвечай ТОЛЬКО JSON, без markdown блоков и комментариев

Формат ответа:
{
  "name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "weight": 200,
  "total_calories": 350,
  "total_protein": 15.5,
  "total_fat": 12.0,
  "total_carbs": 45.2
}`
        }
      ],
      max_tokens: config.openai.maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    console.log('[analyzeFoodFromText] Raw OpenAI response:', content);
    console.log('[analyzeFoodFromText] Response type:', typeof content);
    
    if (!content) {
      console.error('[analyzeFoodFromText] No content in response');
      throw new Error('No response from OpenAI');
    }

    // Try to extract JSON from response (in case there's extra text)
    let jsonContent = content.trim();
    
    // Remove markdown code blocks if present
    jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Try to find JSON object
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    console.log('[analyzeFoodFromText] Cleaned JSON content:', jsonContent);

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(jsonContent);
      console.log('[analyzeFoodFromText] Parsed analysis:', JSON.stringify(analysis));
    } catch (parseError) {
      console.error('[analyzeFoodFromText] JSON parse error:', parseError);
      console.error('[analyzeFoodFromText] Failed to parse content:', content);
      throw new Error('Не удалось распознать формат ответа. Попробуй быть более конкретным (например: "Овсянка 100г с бананом 150г")');
    }
    
    // Validate required fields
    if (!analysis.total_calories && !analysis.calories) {
      console.error('[analyzeFoodFromText] Missing calories in response:', analysis);
      throw new Error('Не удалось определить калорийность. Попробуй описать блюдо подробнее с указанием веса.');
    }
    
    // Use total values directly (no need to multiply)
    const weight = analysis.weight || 100;

    const result = {
      name: analysis.name || 'Неизвестное блюдо',
      ingredients: analysis.ingredients || [],
      weight: weight,
      calories: Math.round(analysis.total_calories || analysis.calories || 0),
      protein: Math.round((analysis.total_protein || analysis.protein || 0) * 10) / 10,
      fat: Math.round((analysis.total_fat || analysis.fat || 0) * 10) / 10,
      carbs: Math.round((analysis.total_carbs || analysis.carbs || 0) * 10) / 10,
    };
    
    console.log('[analyzeFoodFromText] Final result:', JSON.stringify(result));
    return result;

  } catch (error) {
    console.error('[analyzeFoodFromText] Error:', error);
    console.error('[analyzeFoodFromText] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    if (error instanceof Error && error.message.includes('распознать формат')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('калорийность')) {
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
  chatHistory?: Array<{role: string, content: string}>,
  dashboardData?: any,
  todayFoodEntries?: any[],
  medicalData?: any[]
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
` : ''}
${dashboardData ? `
Прогресс за сегодня:
- Калории: ${dashboardData.calories.consumed} из ${dashboardData.calories.target} ккал (осталось ${dashboardData.calories.target - dashboardData.calories.consumed} ккал)
- Белки: ${dashboardData.macros.protein.consumed}г из ${dashboardData.macros.protein.target}г (осталось ${dashboardData.macros.protein.target - dashboardData.macros.protein.consumed}г)
- Жиры: ${dashboardData.macros.fat.consumed}г из ${dashboardData.macros.fat.target}г (осталось ${dashboardData.macros.fat.target - dashboardData.macros.fat.consumed}г)
- Углеводы: ${dashboardData.macros.carbs.consumed}г из ${dashboardData.macros.carbs.target}г (осталось ${dashboardData.macros.carbs.target - dashboardData.macros.carbs.consumed}г)
- Вода: ${dashboardData.water.consumed}мл из ${dashboardData.water.target}мл (осталось ${dashboardData.water.target - dashboardData.water.consumed}мл)
` : ''}
${todayFoodEntries && todayFoodEntries.length > 0 ? `
Приемы пищи сегодня:
${todayFoodEntries.map((entry: any, index: number) => {
  const food = entry.food_data;
  const mealType = entry.meal_type === 'breakfast' ? 'Завтрак' : 
                   entry.meal_type === 'lunch' ? 'Обед' : 
                   entry.meal_type === 'dinner' ? 'Ужин' : 'Перекус';
  return `${index + 1}. ${mealType}: ${food.name} (${food.calories} ккал, Б${food.protein}г Ж${food.fat}г У${food.carbs}г)`;
}).join('\n')}
` : ''}
${medicalData && medicalData.length > 0 ? `
Медицинские анализы пользователя (последние данные):
${medicalData.slice(0, 3).map((item: any, index: number) => {
  const typeText = item.type === 'blood' ? '🩸 Анализ крови' : 
                   item.type === 'urine' ? '💧 Анализ мочи' : 
                   item.type === 'hormones' ? '💊 Гормоны' : '📋 Другое';
  const dateText = new Date(item.date).toLocaleDateString('ru-RU');
  return `\n${index + 1}. ${typeText} (${dateText}):\n${item.analysis || 'Нет данных'}`;
}).join('\n')}

⚠️ ВАЖНО: Учитывай медицинские показатели при советах! 
Например:
- Низкий гемоглобин → рекомендуй продукты с железом (печень, гречка, гранат)
- Высокий холестерин → меньше жирного мяса, больше рыбы
- Проблемы с щитовидкой → йодсодержащие продукты
` : ''}
ВАЖНО: Используй эти данные для персонализированных советов! Например, если спрашивают про воду - говори точные цифры из прогресса.`;

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
      max_tokens: 700, // Increased for responses with medical context
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
 * Analyze medical photo (extract data from medical test results)
 */
export async function analyzeMedicalPhoto(imageUrl: string): Promise<{ text: string; data: any }> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Ты медицинский ассистент. Проанализируй это изображение медицинского анализа.

ЗАДАЧА:
Извлеки ВСЕ видимые показатели, их значения, единицы измерения и нормы (референсные значения).

ВАЖНО:
- Это может быть анализ крови, мочи, гормоны, биохимия и т.д.
- Если видишь медицинские показатели - обязательно их распознай
- Будь внимательным к деталям и цифрам

ФОРМАТ ОТВЕТА:
📋 Тип анализа: [укажи какой это анализ]
📅 Дата: [если видна дата, иначе "не указана"]

📊 Показатели:
• [Название]: [значение] [единицы] (норма: [референсное значение])
• [Название]: [значение] [единицы] (норма: [референсное значение])
...

ПРИМЕР:
📋 Тип анализа: Общий анализ крови
📅 Дата: 15.01.2024

📊 Показатели:
• Гемоглобин: 140 г/л (норма: 130-160 г/л)
• Эритроциты: 4.5 млн/мкл (норма: 4.0-5.0 млн/мкл)
• Лейкоциты: 6.2 тыс/мкл (норма: 4.0-9.0 тыс/мкл)

Внимательно изучи изображение и извлеки ВСЕ показатели!`
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
      max_tokens: 1500, // Increased for detailed medical analyses
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[analyzeMedicalPhoto] OpenAI response:', content);

    // Return extracted text and attempt to parse structured data
    return {
      text: content,
      data: {} // Can add structured parsing later if needed
    };

  } catch (error) {
    console.error('Error analyzing medical photo:', error);
    throw new Error('Не удалось проанализировать фото медицинского анализа.');
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