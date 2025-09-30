import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-5-nano', // В 3х раза дешевле чем gpt-4o-mini! Input: $0.05/1M, Output: $0.40/1M
    visionModel: 'gpt-5-nano', // Для анализа фото еды и медицинских данных
    maxTokens: 1000,
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  // App
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Water tracking defaults
  water: {
    defaultTarget: 2000, // ml
    standardPortions: [100, 250, 500, 750], // ml
  },

  // Activity level multipliers for TDEE calculation
  activityMultipliers: {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  },
} as const;

// Validation
export function validateConfig(): void {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
