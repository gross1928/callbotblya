import { Context } from 'telegraf';
import { createUserProfile, saveUserSession, clearUserSession } from '../database/queries';
import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateTargetMacros } from '../utils/calculations';
import type { CustomContext, UserProfile, ActivityLevel, UserGoal } from '../types';

interface ProfileData {
  name?: string;
  age?: number;
  gender?: 'male' | 'female';
  height?: number;
  weight?: number;
  activityLevel?: ActivityLevel;
  goal?: UserGoal;
  targetWeight?: number;
  targetDate?: string;
}

const activityLevels: { [key: string]: ActivityLevel } = {
  '1': 'sedentary',
  '2': 'light',
  '3': 'moderate',
  '4': 'active',
  '5': 'very_active',
};

const goals: { [key: string]: UserGoal } = {
  '1': 'lose',
  '2': 'maintain',
  '3': 'gain',
};

export async function handleProfileStep(ctx: CustomContext, message: string): Promise<void> {
  console.log('handleProfileStep called:', { 
    currentStep: ctx.currentStep, 
    hasTempData: !!ctx.tempData,
    message: message.substring(0, 50) 
  });
  
  if (!ctx.currentStep || !ctx.tempData) {
    console.log('Missing currentStep or tempData, returning');
    return;
  }

  const step = ctx.currentStep;
  const data = ctx.tempData as ProfileData;

  switch (step) {
    case 'name':
      await handleName(ctx, message, data);
      break;
    case 'age':
      await handleAge(ctx, message, data);
      break;
    case 'gender':
      await handleGender(ctx, message, data);
      break;
    case 'height':
      await handleHeight(ctx, message, data);
      break;
    case 'weight':
      await handleWeight(ctx, message, data);
      break;
    case 'activity':
      await handleActivity(ctx, message, data);
      break;
    case 'goal':
      await handleGoal(ctx, message, data);
      break;
    case 'target_weight':
      await handleTargetWeight(ctx, message, data);
      break;
    case 'target_date':
      await handleTargetDate(ctx, message, data);
      break;
    default:
      await ctx.reply('Неизвестный шаг регистрации');
  }
}

async function handleName(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  if (message.length < 2) {
    await ctx.reply('Имя должно содержать минимум 2 символа. Попробуй еще раз:');
    return;
  }

  data.name = message.trim();
  ctx.tempData = data;
  ctx.currentStep = 'age';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'age', data);

  await ctx.reply(
    `Приятно познакомиться, ${data.name}! 😊\n\n` +
    'Сколько тебе лет?'
  );
}

async function handleAge(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  const age = parseInt(message);
  
  if (isNaN(age) || age < 1 || age > 150) {
    await ctx.reply('Пожалуйста, введи корректный возраст (от 1 до 150 лет):');
    return;
  }

  data.age = age;
  ctx.tempData = data;
  ctx.currentStep = 'gender';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'gender', data);

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👨 Мужской', callback_data: 'gender_male' }],
        [{ text: '👩 Женский', callback_data: 'gender_female' }],
      ],
    },
  };

  await ctx.reply('Выбери пол:', keyboard);
}

async function handleGender(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  // This will be handled by callback query
}

export async function handleGenderCallback(ctx: CustomContext, gender: 'male' | 'female'): Promise<void> {
  const data = ctx.tempData as ProfileData;
  data.gender = gender;
  ctx.tempData = data;
  ctx.currentStep = 'height';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'height', data);

  await ctx.reply(
    'Отлично! Теперь укажи свой рост в сантиметрах.\n\n' +
    'Например: 175'
  );
}

async function handleHeight(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  const height = parseFloat(message);
  
  if (isNaN(height) || height < 50 || height > 250) {
    await ctx.reply('Пожалуйста, введи корректный рост в сантиметрах (от 50 до 250):');
    return;
  }

  data.height = height;
  ctx.tempData = data;
  ctx.currentStep = 'weight';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'weight', data);

  await ctx.reply(
    'Отлично! Теперь укажи свой текущий вес в килограммах.\n\n' +
    'Например: 70.5'
  );
}

async function handleWeight(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  const weight = parseFloat(message);
  
  if (isNaN(weight) || weight < 20 || weight > 300) {
    await ctx.reply('Пожалуйста, введи корректный вес в килограммах (от 20 до 300):');
    return;
  }

  data.weight = weight;
  ctx.tempData = data;
  ctx.currentStep = 'activity';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'activity', data);

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '1️⃣ Малоподвижный (офисная работа)', callback_data: 'activity_1' }],
        [{ text: '2️⃣ Легкая активность (1-3 тренировки/неделя)', callback_data: 'activity_2' }],
        [{ text: '3️⃣ Умеренная активность (3-5 тренировок/неделя)', callback_data: 'activity_3' }],
        [{ text: '4️⃣ Высокая активность (6-7 тренировок/неделя)', callback_data: 'activity_4' }],
        [{ text: '5️⃣ Очень высокая активность (2+ тренировки/день)', callback_data: 'activity_5' }],
      ],
    },
  };

  await ctx.reply(
    'Выбери уровень своей активности:',
    keyboard
  );
}

async function handleActivity(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  // This will be handled by callback query
}

export async function handleActivityCallback(ctx: CustomContext, activityKey: string): Promise<void> {
  const data = ctx.tempData as ProfileData;
  const activityLevel = activityLevels[activityKey];
  
  if (!activityLevel) {
    await ctx.reply('Неверный выбор активности. Попробуй еще раз.');
    return;
  }

  data.activityLevel = activityLevel;
  ctx.tempData = data;
  ctx.currentStep = 'goal';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'goal', data);

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📉 Похудеть', callback_data: 'goal_1' }],
        [{ text: '⚖️ Поддерживать вес', callback_data: 'goal_2' }],
        [{ text: '📈 Набрать вес', callback_data: 'goal_3' }],
      ],
    },
  };

  await ctx.reply(
    'Какая у тебя цель?',
    keyboard
  );
}

async function handleGoal(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  // This will be handled by callback query
}

export async function handleGoalCallback(ctx: CustomContext, goalKey: string): Promise<void> {
  const data = ctx.tempData as ProfileData;
  const goal = goals[goalKey];
  
  if (!goal) {
    await ctx.reply('Неверный выбор цели. Попробуй еще раз.');
    return;
  }

  data.goal = goal;
  ctx.tempData = data;

  if (goal === 'lose' || goal === 'gain') {
    ctx.currentStep = 'target_weight';
    // Save session state to database
    await saveUserSession(ctx.from!.id, 'target_weight', data);
    
    await ctx.reply(
      'Укажи желаемый вес в килограммах.\n\n' +
      'Например: 65'
    );
  } else {
    await finishProfileRegistration(ctx, data);
  }
}

async function handleTargetWeight(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  const targetWeight = parseFloat(message);
  
  if (isNaN(targetWeight) || targetWeight < 20 || targetWeight > 300) {
    await ctx.reply('Пожалуйста, введи корректный желаемый вес в килограммах (от 20 до 300):');
    return;
  }

  data.targetWeight = targetWeight;
  ctx.tempData = data;
  ctx.currentStep = 'target_date';

  // Save session state to database
  await saveUserSession(ctx.from!.id, 'target_date', data);

  await ctx.reply(
    'За какой период хочешь достичь этого веса? (в месяцах)\n\n' +
    'Например: 6'
  );
}

async function handleTargetDate(ctx: CustomContext, message: string, data: ProfileData): Promise<void> {
  const months = parseInt(message);
  
  if (isNaN(months) || months < 1 || months > 60) {
    await ctx.reply('Пожалуйста, введи корректное количество месяцев (от 1 до 60):');
    return;
  }

  data.targetDate = months.toString();
  ctx.tempData = data;

  await finishProfileRegistration(ctx, data);
}

async function finishProfileRegistration(ctx: CustomContext, data: ProfileData): Promise<void> {
  try {
    if (!ctx.from?.id || !data.name || !data.age || !data.gender || !data.height || !data.weight || !data.activityLevel || !data.goal) {
      await ctx.reply('Ошибка: не все данные заполнены. Начни регистрацию заново командой /profile');
      return;
    }

    // Calculate BMR, TDEE and target macros
    const bmr = calculateBMR({
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
    });

    const tdee = calculateTDEE(bmr, data.activityLevel);
    const targetCalories = calculateTargetCalories(tdee, data.goal);
    const targetMacros = calculateTargetMacros(targetCalories, data.goal);

    // Create user profile
    const profileData: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> = {
      telegram_id: ctx.from.id,
      name: data.name,
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      activity_level: data.activityLevel,
      goal: data.goal,
      target_weight: data.targetWeight,
      target_date: data.targetDate,
      bmr,
      tdee,
      target_calories: targetCalories,
      target_protein: targetMacros.protein,
      target_fat: targetMacros.fat,
      target_carbs: targetMacros.carbs,
    };

    const user = await createUserProfile(profileData);
    
    // Clear registration state
    ctx.currentStep = undefined;
    ctx.tempData = undefined;
    ctx.user = user;
    ctx.isNewUser = false;
    
    // Clear session from database
    await clearUserSession(ctx.from!.id);

    const targetText = data.targetWeight ? `\n<b>Желаемый вес:</b> ${data.targetWeight} кг за ${data.targetDate} месяцев` : '';
    
    const successMessage = `
🎉 <b>Профиль создан успешно!</b>

👤 <b>Твои данные:</b>
• Имя: ${data.name}
• Возраст: ${data.age} лет
• Пол: ${data.gender === 'male' ? 'Мужской' : 'Женский'}
• Рост: ${data.height} см
• Вес: ${data.weight} кг
• Активность: ${getActivityLevelText(data.activityLevel)}
• Цель: ${getGoalText(data.goal)}${targetText}

📊 <b>Твои расчеты:</b>
• BMR: ${bmr} ккал
• TDEE: ${tdee} ккал
• Целевые калории: ${targetCalories} ккал
• Белки: ${targetMacros.protein}г
• Жиры: ${targetMacros.fat}г
• Углеводы: ${targetMacros.carbs}г

Теперь можешь начать отслеживать свое питание! 🍎
    `;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Дашборд', callback_data: 'dashboard' }],
          [{ text: '🍎 Добавить еду', callback_data: 'add_food' }],
          [{ text: '💧 Добавить воду', callback_data: 'add_water' }],
        ],
      },
    };

    await ctx.replyWithHTML(successMessage, keyboard);

  } catch (error) {
    console.error('Error creating profile:', error);
    await ctx.reply(
      'Произошла ошибка при создании профиля. Попробуй еще раз командой /profile'
    );
  }
}

function getActivityLevelText(level: ActivityLevel): string {
  const levels = {
    sedentary: 'Малоподвижный',
    light: 'Легкая активность',
    moderate: 'Умеренная активность',
    active: 'Высокая активность',
    very_active: 'Очень высокая активность',
  };
  return levels[level];
}

function getGoalText(goal: UserGoal): string {
  const goals = {
    lose: 'Похудение',
    maintain: 'Поддержание веса',
    gain: 'Набор веса',
  };
  return goals[goal];
}
