// User Profile Types
export interface UserProfile {
  id: string;
  telegram_id: number;
  name: string;
  age: number;
  gender: 'male' | 'female';
  height: number; // cm
  weight: number; // kg
  activity_level: ActivityLevel;
  goal: UserGoal;
  target_weight?: number;
  target_date?: string;
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  created_at: string;
  updated_at: string;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type UserGoal = 'lose' | 'maintain' | 'gain';

// Food Analysis Types
export interface FoodAnalysis {
  name: string;
  ingredients: string[];
  weight: number; // grams
  calories: number;
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
  fiber?: number; // grams
  sugar?: number; // grams
}

export interface FoodEntry {
  id: string;
  user_id: string;
  meal_type: MealType;
  food_data: FoodAnalysis;
  timestamp: string;
  created_at: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Water Tracking Types
export interface WaterEntry {
  id: string;
  user_id: string;
  amount: number; // ml
  timestamp: string;
  created_at: string;
}

// Medical Data Types
export interface MedicalData {
  id: string;
  user_id: string;
  type: MedicalDataType;
  date: string;
  data: Record<string, any>;
  analysis?: string;
  recommendations?: string;
  created_at: string;
}

export type MedicalDataType = 'blood' | 'hormones' | 'urine' | 'other';

// Dashboard Types
export interface DashboardData {
  date: string;
  calories: {
    consumed: number;
    target: number;
  };
  macros: {
    protein: { consumed: number; target: number };
    fat: { consumed: number; target: number };
    carbs: { consumed: number; target: number };
  };
  water: {
    consumed: number; // ml
    target: number; // ml
  };
  weight?: number;
}

// AI Coach Types
export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Telegram Bot Types
export interface BotContext {
  user?: UserProfile;
  isNewUser: boolean;
  currentStep?: string;
  tempData?: Record<string, any>;
}

// Utility Types
export interface ProgressBar {
  current: number;
  target: number;
  percentage: number;
  emoji: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
