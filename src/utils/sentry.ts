import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { config } from '../config';
import axios from 'axios';

// Telegram notification configuration
const TELEGRAM_ERROR_BOT_TOKEN = process.env.TELEGRAM_ERROR_BOT_TOKEN;
const TELEGRAM_ERROR_CHAT_ID = process.env.TELEGRAM_ERROR_CHAT_ID;

/**
 * Initialize Sentry for error tracking
 */
export function initSentry(): void {
  // Check if Telegram notifications are configured
  if (TELEGRAM_ERROR_BOT_TOKEN && TELEGRAM_ERROR_CHAT_ID) {
    console.log('[Error Tracking] Telegram notifications enabled');
  } else {
    console.log('[Error Tracking] Telegram notifications not configured');
  }

  // Only initialize Sentry if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // For production, lower this to 0.1 (10%) to reduce costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Profiling
    profilesSampleRate: 0.1, // 10% of transactions will have profiling enabled
    
    integrations: [
      nodeProfilingIntegration(),
    ],
    
    // Filter out sensitive information
    beforeSend(event) {
      // Remove sensitive data from event if needed
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Send error notification to Telegram
 */
async function sendTelegramNotification(message: string): Promise<void> {
  if (!TELEGRAM_ERROR_BOT_TOKEN || !TELEGRAM_ERROR_CHAT_ID) {
    return; // Telegram notifications not configured
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_ERROR_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_ERROR_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('[Telegram Notification] Failed to send:', error);
  }
}

/**
 * Format error for Telegram notification
 */
function formatErrorForTelegram(error: Error, context?: Record<string, any>): string {
  const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  
  let message = `🚨 <b>ОШИБКА В БОТЕ</b>\n\n`;
  message += `❌ <b>Тип:</b> ${error.name}\n`;
  message += `📝 <b>Сообщение:</b> ${error.message}\n\n`;
  
  // Add context if provided
  if (context) {
    if (context.user) {
      message += `👤 <b>Пользователь:</b>\n`;
      message += `  • ID: ${context.user.telegram_id || context.telegramId || 'неизвестно'}\n`;
      message += `  • Имя: ${context.user.name || 'неизвестно'}\n\n`;
    }
    
    if (context.currentStep) {
      message += `📍 <b>Текущий шаг:</b> ${context.currentStep}\n\n`;
    }
    
    if (context.context) {
      message += `🔍 <b>Контекст:</b> ${context.context}\n\n`;
    }
  }
  
  // Add stack trace (limited to avoid message being too long)
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 8);
    message += `📊 <b>Stack Trace:</b>\n<code>${stackLines.join('\n')}</code>\n\n`;
  }
  
  message += `⏰ <b>Время:</b> ${timestamp}`;
  
  // Telegram message limit is 4096 characters
  if (message.length > 4000) {
    message = message.substring(0, 3900) + '\n\n... (обрезано)';
  }
  
  return message;
}

/**
 * Capture an exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  // Send to Telegram
  const telegramMessage = formatErrorForTelegram(error, context);
  sendTelegramNotification(telegramMessage).catch(err => {
    console.error('[Telegram Notification] Failed:', err);
  });
  
  // Send to Sentry if configured
  if (process.env.SENTRY_DSN) {
    if (context) {
      Sentry.setContext('additional', context);
    }
    Sentry.captureException(error);
  }
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for better error tracking
 */
export function setUserContext(userId: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    username: username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };

