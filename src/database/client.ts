import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { UserProfile, FoodEntry, WaterEntry, MedicalData, ChatMessage } from '../types';

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Database table types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'telegram_id'>>;
      };
      food_entries: {
        Row: FoodEntry;
        Insert: Omit<FoodEntry, 'id' | 'created_at'>;
        Update: Partial<Omit<FoodEntry, 'id' | 'created_at' | 'user_id'>>;
      };
      water_entries: {
        Row: WaterEntry;
        Insert: Omit<WaterEntry, 'id' | 'created_at'>;
        Update: Partial<Omit<WaterEntry, 'id' | 'created_at' | 'user_id'>>;
      };
      medical_data: {
        Row: MedicalData;
        Insert: Omit<MedicalData, 'id' | 'created_at'>;
        Update: Partial<Omit<MedicalData, 'id' | 'created_at' | 'user_id'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id'>;
        Update: Partial<Omit<ChatMessage, 'id' | 'user_id'>>;
      };
    };
  };
}

// Typed Supabase client
export const db = supabase as any;
