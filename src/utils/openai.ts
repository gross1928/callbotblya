import OpenAI from 'openai';
import { config } from '../config';
import type { FoodAnalysis } from '../types';
import { searchProduct, calculateNutritionForWeight, ProductNutrition } from '../database/products-queries';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Log database config status
console.log('[CONFIG] USE_PRODUCTS_DATABASE env:', process.env.USE_PRODUCTS_DATABASE);
console.log('[CONFIG] config.food.useProductsDatabase:', config.food.useProductsDatabase);

/**
 * Analyze food photo and recognize only ingredients and weights (without calculating nutrition)
 * AI just identifies products, database provides accurate nutrition
 */
async function analyzeFoodPhotoIngredientsOnly(imageUrl: string): Promise<FoodIngredientAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Проанализируй фото еды и определи:
1. Название блюда
2. Список всех ингредиентов с их примерным весом в граммах

ВАЖНО:
- Определяй ВСЕ видимые ингредиенты (основные продукты)
- Вес укажи для каждого ингредиента отдельно
- Если жареное (есть корочка, блестит от масла) - укажи масло (5-10г)
- Для салатов - укажи каждый овощ отдельно
- Для сложных блюд - разбей на основные компоненты
- Будь реалистичен с весом

ПРИМЕРЫ:
- "Куриная грудка с рисом" → [{"product": "куриная грудка", "weight": 200}, {"product": "рис белый вареный", "weight": 150}]
- "Яичница" → [{"product": "яйцо куриное", "weight": 100}, {"product": "масло подсолнечное", "weight": 10}]

Ответь ТОЛЬКО в формате JSON:
{
  "dish_name": "название блюда",
  "ingredients": [
    {"product": "название продукта", "weight": вес_в_граммах},
    {"product": "название продукта 2", "weight": вес_в_граммах}
  ]
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
      max_completion_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[analyzeFoodPhotoIngredientsOnly] OpenAI response:', content);

    // Extract JSON
    let jsonContent = content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    const analysis: FoodIngredientAnalysis = JSON.parse(jsonContent);
    
    if (!analysis.ingredients || analysis.ingredients.length === 0) {
      throw new Error('Не удалось определить ингредиенты');
    }

    return analysis;
  } catch (error) {
    console.error('[analyzeFoodPhotoIngredientsOnly] Error:', error);
    throw new Error('Не удалось распознать ингредиенты на фото.');
  }
}

/**
 * Analyze food from photo using Vision API
 * With products database integration for accurate nutrition
 */
export async function analyzeFoodFromPhoto(imageUrl: string): Promise<FoodAnalysis> {
  try {
    console.log('[analyzeFoodFromPhoto] Starting photo analysis, imageUrl:', imageUrl.substring(0, 50) + '...');
    
    // Use products database if enabled
    if (config.food.useProductsDatabase) {
      console.log('[analyzeFoodFromPhoto] Using products database for accurate nutrition');
      try {
        const ingredientAnalysis = await analyzeFoodPhotoIngredientsOnly(imageUrl);
        const enrichedAnalysis = await enrichWithDatabaseNutrition(ingredientAnalysis);
        console.log('[analyzeFoodFromPhoto] Successfully used database:', enrichedAnalysis);
        return enrichedAnalysis;
      } catch (dbError) {
        console.log('[analyzeFoodFromPhoto] Database enrichment failed, falling back to AI:', dbError);
        // Continue with AI-only analysis below
      }
    }
    
    // Fallback: AI-only analysis (old method)
    console.log('[analyzeFoodFromPhoto] Using AI-only analysis');
    const response = await openai.chat.completions.create({
      model: config.openai.visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Ты эксперт-нутрициолог. Проанализируй фото еды и определи КБЖУ.

ВАЖНЫЕ ПРАВИЛА:
1. Считай КБЖУ для ВСЕЙ порции на фото (не на 100г!)
2. Будь КОНСЕРВАТИВНЫМ в оценках - лучше немного занизить, чем завысить
3. Проверяй разумность: 200г куриной грудки ≈ 330 ккал, яйцо ≈ 80 ккал, банан ≈ 100 ккал
4. Учитывай способ приготовления:
   - Вареное/паровое/запеченное БЕЗ масла → не добавляй масло
   - ЯВНО жареное (корочка, блестит от масла) → добавь 5-10г масла к расчету
   - Салаты → учитывай заправку ТОЛЬКО если она явно видна на фото
5. Соусы учитывай ТОЛЬКО если они видны на фото
6. Если сомневаешься → выбирай меньшее значение калорий

ПРИМЕРЫ правильного расчета:
- Овсянка 50г + банан 120г + молоко 100мл = 250 ккал (не 400!)
- Куриная грудка 200г на пару = 330 ккал (не 500!)
- Жареная яичница 2 яйца + 5г масла = 160 + 45 = 205 ккал

Определи:
1. Название блюда
2. Ингредиенты (список, учитывая способ приготовления)
3. Примерный вес порции в граммах (будь реалистичен)
4. Общие калории ВСЕЙ порции
5. Общие белки ВСЕЙ порции в граммах
6. Общие жиры ВСЕЙ порции в граммах
7. Общие углеводы ВСЕЙ порции в граммах

Ответь ТОЛЬКО в формате JSON без дополнительного текста:
{
  "name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "weight": вес_в_граммах,
  "total_calories": общие_калории_всей_порции,
  "total_protein": общие_белки_всей_порции_в_граммах,
  "total_fat": общие_жиры_всей_порции_в_граммах,
  "total_carbs": общие_углеводы_всей_порции_в_граммах
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
      max_completion_tokens: 12000,
    });

    console.log('[analyzeFoodFromPhoto] Finish reason:', response.choices[0]?.finish_reason);
    console.log('[analyzeFoodFromPhoto] Usage:', response.usage);

    // Check if response was truncated due to token limit
    if (response.choices[0]?.finish_reason === 'length') {
      console.error('[analyzeFoodFromPhoto] Response truncated due to token limit');
      throw new Error('Ответ модели был обрезан. Попробуй другое фото или опиши блюдо текстом.');
    }

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
    
    // Use products database if enabled
    if (config.food.useProductsDatabase) {
      console.log('[analyzeFoodFromText] Using products database for accurate nutrition');
      try {
        const ingredientAnalysis = await analyzeFoodIngredientsOnly(description, false);
        const enrichedAnalysis = await enrichWithDatabaseNutrition(ingredientAnalysis);
        console.log('[analyzeFoodFromText] Successfully used database:', enrichedAnalysis);
        return enrichedAnalysis;
      } catch (dbError) {
        console.log('[analyzeFoodFromText] Database enrichment failed, falling back to AI:', dbError);
        // Continue with AI-only analysis below
      }
    }
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `Ты эксперт-нутрициолог. Анализируй описания еды и предоставляй информацию о КБЖУ в формате JSON.
ВАЖНО: Всегда отвечай только валидным JSON. Никакого markdown, никакого дополнительного текста.
Даже если описание неточное, дай разумную оценку.`
        },
        {
          role: 'user',
          content: `Проанализируй описание еды: "${description}"

ВАЖНЫЕ ПРАВИЛА:
1. Считай КБЖУ для ВСЕЙ порции из описания (не на 100г!)
2. Будь КОНСЕРВАТИВНЫМ в оценках - лучше немного занизить, чем завысить
3. Проверяй разумность результата:
   - 200г куриной грудки ≈ 330 ккал (не 500!)
   - Яйцо среднее ≈ 80 ккал
   - Банан средний (120г) ≈ 100 ккал
   - Овсянка 50г сухой ≈ 180 ккал
4. Учитывай способ приготовления ИЗ ОПИСАНИЯ:
   - Если указано "вареное/паровое/запеченное" → НЕ добавляй масло
   - Если указано "жареное" → добавь 5-10г масла
   - Если НЕ указано и НЕ понятно → НЕ добавляй масло (консервативно)
5. Масло/соусы учитывай ТОЛЬКО если они упомянуты в описании
6. Если вес не указан → используй стандартную порцию (но будь консервативен)
7. Если сомневаешься → выбирай МЕНЬШЕЕ значение калорий

ПРИМЕРЫ правильного расчета:
- "Овсянка 50г с бананом" → овсянка 180 ккал + банан 100 ккал = 280 ккал
- "Куриная грудка 200г на пару" → 330 ккал (без масла!)
- "Жареная яичница 2 яйца" → 2 яйца 160 ккал + масло 10г 90 ккал = 250 ккал
- "Салат овощной 150г" → 40-60 ккал (БЕЗ заправки, если не указана!)

Определи:
1. Название блюда (если неясно - предложи похожее)
2. Ингредиенты (список, даже если приблизительный)
3. Примерный вес порции в граммах (если не указан - стандартная порция)
4. Общие калории ВСЕЙ порции
5. Общие белки ВСЕЙ порции в граммах
6. Общие жиры ВСЕЙ порции в граммах
7. Общие углеводы ВСЕЙ порции в граммах

Ответь ТОЛЬКО в формате JSON (без markdown блоков):
{
  "name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "weight": вес_в_граммах,
  "total_calories": общие_калории_всей_порции,
  "total_protein": общие_белки_всей_порции,
  "total_fat": общие_жиры_всей_порции,
  "total_carbs": общие_углеводы_всей_порции
}`
        }
      ],
      max_completion_tokens: 12000, // Increased significantly for reasoning model (gpt-5-nano) - needs space for reasoning + JSON response
      // temperature не указывается - gpt-5-nano использует только дефолтное значение 1
      response_format: { type: "json_object" }
    });

    console.log('[analyzeFoodFromText] Full response object:', JSON.stringify(response, null, 2));
    console.log('[analyzeFoodFromText] Choices:', response.choices);
    console.log('[analyzeFoodFromText] First choice:', response.choices[0]);
    console.log('[analyzeFoodFromText] Message:', response.choices[0]?.message);
    console.log('[analyzeFoodFromText] Finish reason:', response.choices[0]?.finish_reason);
    console.log('[analyzeFoodFromText] Usage:', response.usage);
    
    const content = response.choices[0]?.message?.content;
    console.log('[analyzeFoodFromText] Raw OpenAI response:', content);
    console.log('[analyzeFoodFromText] Response type:', typeof content);
    console.log('[analyzeFoodFromText] Response length:', content?.length);
    
    // Check if response was truncated due to token limit
    if (response.choices[0]?.finish_reason === 'length') {
      console.error('[analyzeFoodFromText] Response truncated due to token limit');
      console.error('[analyzeFoodFromText] Full response:', JSON.stringify(response, null, 2));
      throw new Error('Ответ модели был обрезан. Попробуй описать блюдо проще или короче.');
    }
    
    if (!content || content.trim().length === 0) {
      console.error('[analyzeFoodFromText] Empty or no content in response');
      console.error('[analyzeFoodFromText] Full response:', JSON.stringify(response, null, 2));
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
      max_completion_tokens: 12000, // Increased significantly for reasoning model with complex context (profile + dashboard + history + medical data)
      // temperature не указывается - gpt-5-nano использует только дефолтное значение 1
    });

    console.log('[getAICoachResponse] Full response:', JSON.stringify(response, null, 2));
    console.log('[getAICoachResponse] Usage:', response.usage);
    console.log('[getAICoachResponse] Finish reason:', response.choices[0]?.finish_reason);
    
    let content = response.choices[0]?.message?.content;
    console.log('[getAICoachResponse] Content length:', content?.length);
    console.log('[getAICoachResponse] Content preview:', content?.substring(0, 100));
    
    if (!content || content.trim().length === 0) {
      console.error('[getAICoachResponse] Empty or no content in response');
      console.error('[getAICoachResponse] Full response:', JSON.stringify(response, null, 2));
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
      max_completion_tokens: 12000, // Increased significantly for reasoning model (gpt-5-nano) - needs space for reasoning + response
      // temperature не указывается - gpt-5-nano использует только дефолтное значение 1
    });

    console.log('[analyzeMedicalPhoto] Finish reason:', response.choices[0]?.finish_reason);
    console.log('[analyzeMedicalPhoto] Usage:', response.usage);

    // Check if response was truncated due to token limit
    if (response.choices[0]?.finish_reason === 'length') {
      console.error('[analyzeMedicalPhoto] Response truncated due to token limit');
      throw new Error('Ответ модели был обрезан. Попробуй другое фото.');
    }

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
      max_completion_tokens: 12000, // Increased significantly for reasoning model (gpt-5-nano) - needs space for reasoning + response
      // temperature не указывается - gpt-5-nano использует только дефолтное значение 1
    });

    console.log('[analyzeMedicalData] Finish reason:', response.choices[0]?.finish_reason);
    console.log('[analyzeMedicalData] Usage:', response.usage);

    // Check if response was truncated due to token limit
    if (response.choices[0]?.finish_reason === 'length') {
      console.error('[analyzeMedicalData] Response truncated due to token limit');
      throw new Error('Ответ модели был обрезан. Попробуй упростить запрос.');
    }

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

/**
 * Interface for ingredient recognition
 */
interface FoodIngredient {
  product: string;
  weight: number;
}

interface FoodIngredientAnalysis {
  dish_name: string;
  ingredients: FoodIngredient[];
}

/**
 * Analyze food and recognize only ingredients and weights (without calculating nutrition)
 * AI just identifies products, database provides accurate nutrition
 */
export async function analyzeFoodIngredientsOnly(description: string, isPhotoAnalysis: boolean = false): Promise<FoodIngredientAnalysis> {
  try {
    const prompt = isPhotoAnalysis
      ? `Проанализируй фото еды и определи:
1. Название блюда
2. Список всех ингредиентов с их примерным весом в граммах

ВАЖНО:
- Определяй ВСЕ видимые ингредиенты (основные продукты)
- Вес укажи для каждого ингредиента отдельно
- Если жареное - укажи масло (5-10г)
- Для салатов - укажи каждый овощ отдельно
- Будь реалистичен с весом

Ответь ТОЛЬКО в формате JSON:
{
  "dish_name": "название блюда",
  "ingredients": [
    {"product": "название продукта", "weight": вес_в_граммах},
    {"product": "название продукта 2", "weight": вес_в_граммах}
  ]
}`
      : `Проанализируй описание еды: "${description}"

Определи:
1. Название блюда (если неясно - предложи похожее)
2. Список всех ингредиентов с их весом

ВАЖНО:
- Извлекай ВСЕ упомянутые продукты
- Если вес не указан - используй стандартные порции
- Если указан способ приготовления "жареное" - добавь масло 5-10г
- Каждый продукт - отдельная строка

Ответь ТОЛЬКО в формате JSON:
{
  "dish_name": "название блюда",
  "ingredients": [
    {"product": "название продукта", "weight": вес_в_граммах},
    {"product": "название продукта 2", "weight": вес_в_граммах}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Ты эксперт по питанию. Распознавай продукты и их вес из описаний еды. Отвечай ТОЛЬКО валидным JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[analyzeFoodIngredientsOnly] OpenAI response:', content);

    const analysis: FoodIngredientAnalysis = JSON.parse(content);
    
    if (!analysis.ingredients || analysis.ingredients.length === 0) {
      throw new Error('Не удалось определить ингредиенты');
    }

    return analysis;
  } catch (error) {
    console.error('[analyzeFoodIngredientsOnly] Error:', error);
    throw new Error('Не удалось распознать ингредиенты. Попробуй описать подробнее.');
  }
}

/**
 * Enrich ingredient analysis with accurate nutrition from database
 */
export async function enrichWithDatabaseNutrition(analysis: FoodIngredientAnalysis): Promise<FoodAnalysis> {
  console.log('[enrichWithDatabaseNutrition] Processing:', analysis);
  
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalWeight = 0;
  const recognizedIngredients: string[] = [];
  
  for (const ingredient of analysis.ingredients) {
    console.log(`[enrichWithDatabaseNutrition] Searching for: ${ingredient.product} (${ingredient.weight}g)`);
    
    // Search in database
    const products = await searchProduct(ingredient.product, 3);
    
    if (products.length > 0 && products[0].similarity && products[0].similarity > 0.4) {
      // Found in database - use accurate data
      const bestMatch = products[0];
      console.log(`[enrichWithDatabaseNutrition] Found match: ${bestMatch.name} (similarity: ${bestMatch.similarity})`);
      
      const nutrition = calculateNutritionForWeight(bestMatch, ingredient.weight);
      
      totalCalories += nutrition.calories;
      totalProtein += nutrition.protein;
      totalFat += nutrition.fat;
      totalCarbs += nutrition.carbs;
      totalWeight += ingredient.weight;
      
      recognizedIngredients.push(`${bestMatch.name} ${ingredient.weight}г`);
      
      console.log(`[enrichWithDatabaseNutrition] Added nutrition:`, nutrition);
    } else {
      // Not found - use AI estimation (fallback)
      console.log(`[enrichWithDatabaseNutrition] Product not found in database: ${ingredient.product}, using AI estimation`);
      
      const aiEstimate = await estimateNutritionWithAI(ingredient.product, ingredient.weight);
      
      totalCalories += aiEstimate.calories;
      totalProtein += aiEstimate.protein;
      totalFat += aiEstimate.fat;
      totalCarbs += aiEstimate.carbs;
      totalWeight += ingredient.weight;
      
      recognizedIngredients.push(`${ingredient.product} ${ingredient.weight}г`);
    }
  }
  
  console.log('[enrichWithDatabaseNutrition] Total nutrition:', {
    calories: totalCalories,
    protein: totalProtein,
    fat: totalFat,
    carbs: totalCarbs,
    weight: totalWeight
  });
  
  return {
    name: analysis.dish_name,
    ingredients: recognizedIngredients,
    weight: totalWeight,
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10
  };
}

/**
 * Estimate nutrition with AI as fallback when product not in database
 */
async function estimateNutritionWithAI(product: string, weight: number): Promise<{
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Ты эксперт-нутрициолог. Оценивай КБЖУ продуктов консервативно (лучше занизить, чем завысить).'
        },
        {
          role: 'user',
          content: `Оцени КБЖУ для: ${product} ${weight}г
          
Ответь ТОЛЬКО JSON:
{
  "calories": калории,
  "protein": белки_в_граммах,
  "fat": жиры_в_граммах,
  "carbs": углеводы_в_граммах
}`
        }
      ],
      max_completion_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No AI estimation');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('[estimateNutritionWithAI] Error:', error);
    // Return conservative estimates if AI fails
    return {
      calories: weight * 1.5, // Very conservative: ~150 kcal per 100g
      protein: weight * 0.05,
      fat: weight * 0.03,
      carbs: weight * 0.25
    };
  }
}

/**
 * Analyze food from photo using database (NEW METHOD)
 */
export async function analyzeFoodFromPhotoWithDB(imageUrl: string): Promise<FoodAnalysis> {
  try {
    // Step 1: AI recognizes ingredients and weights
    const ingredientsAnalysis = await analyzeFoodIngredientsFromPhoto(imageUrl);
    
    // Step 2: Database provides accurate nutrition
    return await enrichWithDatabaseNutrition(ingredientsAnalysis);
  } catch (error) {
    console.error('[analyzeFoodFromPhotoWithDB] Error:', error);
    // Fallback to old method
    return await analyzeFoodFromPhoto(imageUrl);
  }
}

/**
 * Analyze food from text using database (NEW METHOD)
 */
export async function analyzeFoodFromTextWithDB(description: string): Promise<FoodAnalysis> {
  try {
    // Step 1: AI recognizes ingredients and weights
    const ingredientsAnalysis = await analyzeFoodIngredientsOnly(description, false);
    
    // Step 2: Database provides accurate nutrition
    return await enrichWithDatabaseNutrition(ingredientsAnalysis);
  } catch (error) {
    console.error('[analyzeFoodFromTextWithDB] Error:', error);
    // Fallback to old method
    return await analyzeFoodFromText(description);
  }
}

/**
 * Analyze ingredients from photo
 */
async function analyzeFoodIngredientsFromPhoto(imageUrl: string): Promise<FoodIngredientAnalysis> {
  const response = await openai.chat.completions.create({
    model: config.openai.visionModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Проанализируй фото еды и определи:
1. Название блюда
2. Список всех ингредиентов с их примерным весом в граммах

ВАЖНО:
- Определяй ВСЕ видимые ингредиенты
- Вес укажи для каждого ингредиента отдельно
- Если видна корочка/блеск от масла - укажи масло (5-10г)
- Будь реалистичен с весом

Ответь ТОЛЬКО в формате JSON:
{
  "dish_name": "название блюда",
  "ingredients": [
    {"product": "название продукта", "weight": вес_в_граммах}
  ]
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
    max_completion_tokens: 2000
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Vision API');
  }

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }

  return JSON.parse(jsonMatch[0]);
}