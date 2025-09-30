import { db } from './client';
import type { 
  UserProfile, 
  FoodEntry, 
  WaterEntry, 
  MedicalData, 
  ChatMessage,
  DashboardData,
  MealType 
} from '../types';

// User Profile Queries
export async function getUserByTelegramId(telegramId: number): Promise<UserProfile | null> {
  const { data, error } = await db
    .from('user_profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data;
}

export async function createUserProfile(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<UserProfile> {
  const { data, error } = await db
    .from('user_profiles')
    .insert(profile)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }

  return data;
}

export async function updateUserProfile(telegramId: number, updates: Partial<UserProfile>): Promise<UserProfile> {
  const { data, error } = await db
    .from('user_profiles')
    .update(updates)
    .eq('telegram_id', telegramId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }

  return data;
}

// Food Entry Queries
export async function addFoodEntry(entry: Omit<FoodEntry, 'id' | 'created_at'>): Promise<FoodEntry> {
  const { data, error } = await db
    .from('food_entries')
    .insert(entry)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add food entry: ${error.message}`);
  }

  return data;
}

export async function getFoodEntriesByDate(userId: string, date: string): Promise<FoodEntry[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await db
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startOfDay.toISOString())
    .lte('timestamp', endOfDay.toISOString())
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to get food entries: ${error.message}`);
  }

  return data || [];
}

// Water Entry Queries
export async function addWaterEntry(entry: Omit<WaterEntry, 'id' | 'created_at'>): Promise<WaterEntry> {
  const { data, error } = await db
    .from('water_entries')
    .insert(entry)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add water entry: ${error.message}`);
  }

  return data;
}

export async function getWaterEntriesByDate(userId: string, date: string): Promise<WaterEntry[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await db
    .from('water_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startOfDay.toISOString())
    .lte('timestamp', endOfDay.toISOString())
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to get water entries: ${error.message}`);
  }

  return data || [];
}

// Medical Data Queries
export async function addMedicalData(medicalData: Omit<MedicalData, 'id' | 'created_at'>): Promise<MedicalData> {
  const { data, error } = await db
    .from('medical_data')
    .insert(medicalData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add medical data: ${error.message}`);
  }

  return data;
}

export async function getMedicalDataByUser(userId: string): Promise<MedicalData[]> {
  const { data, error } = await db
    .from('medical_data')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to get medical data: ${error.message}`);
  }

  return data || [];
}

// Chat Message Queries
export async function addChatMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
  const { data, error } = await db
    .from('chat_messages')
    .insert(message)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add chat message: ${error.message}`);
  }

  return data;
}

export async function getChatHistory(userId: string, limit: number = 10): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get chat history: ${error.message}`);
  }

  return (data || []).reverse(); // Return in chronological order
}

// Dashboard Data Query
export async function getDashboardData(userId: string, date: string): Promise<DashboardData> {
  const user = await getUserByTelegramId(parseInt(userId)); // Assuming userId is telegram_id
  if (!user) {
    throw new Error('User not found');
  }

  const foodEntries = await getFoodEntriesByDate(user.id, date);
  const waterEntries = await getWaterEntriesByDate(user.id, date);

  // Calculate consumed calories and macros
  const consumed = foodEntries.reduce((acc, entry) => {
    const food = entry.food_data;
    return {
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      fat: acc.fat + food.fat,
      carbs: acc.carbs + food.carbs,
    };
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  // Calculate consumed water
  const consumedWater = waterEntries.reduce((acc, entry) => acc + entry.amount, 0);

  return {
    date,
    calories: {
      consumed: consumed.calories,
      target: user.target_calories,
    },
    macros: {
      protein: { consumed: consumed.protein, target: user.target_protein },
      fat: { consumed: consumed.fat, target: user.target_fat },
      carbs: { consumed: consumed.carbs, target: user.target_carbs },
    },
    water: {
      consumed: consumedWater,
      target: 2000, // Default water target, could be user-configurable
    },
  };
}

// Session Management Queries
export async function getUserSession(telegramId: number): Promise<{currentStep?: string, tempData?: any} | null> {
  console.log(`[getUserSession] Getting session for telegramId: ${telegramId}`);
  
  const { data, error } = await db
    .from('user_sessions')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  console.log(`[getUserSession] Query result:`, { data, error });

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting user session:', error);
    return null;
  }

  const result = data ? { currentStep: data.current_step, tempData: data.temp_data } : null;
  console.log(`[getUserSession] Returning:`, result);
  return result;
}

export async function saveUserSession(telegramId: number, currentStep?: string, tempData?: any): Promise<void> {
  console.log(`[saveUserSession] Saving session for telegramId: ${telegramId}, currentStep: ${currentStep}`);
  
  // Безопасное логирование tempData
  try {
    const tempDataSummary = tempData ? {
      keys: Object.keys(tempData),
      size: JSON.stringify(tempData).length,
      type: typeof tempData
    } : 'null/undefined';
    console.log(`[saveUserSession] tempData summary:`, tempDataSummary);
  } catch (logErr) {
    console.log(`[saveUserSession] tempData: [unable to stringify]`);
  }
  
  const { error } = await db
    .from('user_sessions')
    .upsert({
      telegram_id: telegramId,
      current_step: currentStep,
      temp_data: tempData || {},
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error saving user session:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to save user session: ${error.message}`);
  }
  
  console.log(`[saveUserSession] Session saved successfully`);
}

export async function clearUserSession(telegramId: number): Promise<void> {
  console.log(`[clearUserSession] DELETING session for telegramId: ${telegramId}`);
  console.log(`[clearUserSession] Called from:`, new Error().stack);
  
  const { error } = await db
    .from('user_sessions')
    .delete()
    .eq('telegram_id', telegramId);

  if (error) {
    console.error('Error clearing user session:', error);
  } else {
    console.log(`[clearUserSession] Session deleted successfully for ${telegramId}`);
  }
}
