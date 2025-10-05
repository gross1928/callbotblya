/**
 * Rate Limiter utility to prevent abuse and reduce costs
 * Protects against spam, DoS attacks, and excessive OpenAI API usage
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

interface UserLimit {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

// Storage for rate limits per user per action
const rateLimits = new Map<string, UserLimit>();

// Predefined limits for different actions
export const RATE_LIMITS = {
  // OpenAI requests (EXPENSIVE! Most critical to limit)
  FOOD_PHOTO_ANALYSIS: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 10 photos per hour
    message: '⚠️ Превышен лимит анализа фото.\n\nМаксимум: 10 фото в час.\n\nПопробуй через {timeLeft}.',
  },
  FOOD_TEXT_ANALYSIS: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 20 text analyses per hour
    message: '⚠️ Превышен лимит анализа блюд.\n\nМаксимум: 20 блюд в час.\n\nПопробуй через {timeLeft}.',
  },
  AI_COACH: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 30 messages per hour
    message: '⚠️ Превышен лимит сообщений AI-коучу.\n\nМаксимум: 30 сообщений в час.\n\nПопробуй через {timeLeft}.',
  },
  MEDICAL_ANALYSIS: {
    maxRequests: 5,
    windowMs: 24 * 60 * 60 * 1000, // 5 analyses per day
    message: '⚠️ Превышен дневной лимит анализа медицинских данных.\n\nМаксимум: 5 анализов в день.\n\nПопробуй завтра.',
  },
  
  // Regular actions (less critical)
  ADD_WATER: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000, // 50 times per hour
    message: '⚠️ Превышен лимит добавления воды.\n\nМаксимум: 50 раз в час.',
  },
  DASHBOARD_VIEW: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 views per hour
    message: '⚠️ Превышен лимит просмотров дашборда.\n\nПопробуй через {timeLeft}.',
  },
  
  // Global limit (catches everything)
  GLOBAL: {
    maxRequests: 200,
    windowMs: 60 * 60 * 1000, // 200 total actions per hour
    message: '⚠️ Превышен общий лимит запросов к боту.\n\nМаксимум: 200 действий в час.\n\nПопробуй через {timeLeft}.',
  },
} as const;

/**
 * Check if user has exceeded rate limit for specific action
 */
export function checkRateLimit(
  userId: number,
  action: keyof typeof RATE_LIMITS
): { allowed: boolean; message?: string; resetIn?: number } {
  const config = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  let userLimit = rateLimits.get(key);
  
  // First request or window expired - reset
  if (!userLimit || now >= userLimit.resetAt) {
    rateLimits.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
      firstRequestAt: now,
    });
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      cleanupExpiredLimits();
    }
    
    return { allowed: true };
  }
  
  // Check if limit exceeded
  if (userLimit.count >= config.maxRequests) {
    const resetIn = userLimit.resetAt - now;
    const timeLeft = formatTimeLeft(resetIn);
    const message = config.message?.replace('{timeLeft}', timeLeft) || 
      `Превышен лимит. Попробуй через ${timeLeft}.`;
    
    return {
      allowed: false,
      message,
      resetIn,
    };
  }
  
  // Increment counter
  userLimit.count++;
  rateLimits.set(key, userLimit);
  
  return { allowed: true };
}

/**
 * Get current usage stats for user
 */
export function getRateLimitStats(
  userId: number,
  action: keyof typeof RATE_LIMITS
): { used: number; limit: number; resetIn: number } {
  const config = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  const userLimit = rateLimits.get(key);
  
  if (!userLimit || now >= userLimit.resetAt) {
    return {
      used: 0,
      limit: config.maxRequests,
      resetIn: config.windowMs,
    };
  }
  
  return {
    used: userLimit.count,
    limit: config.maxRequests,
    resetIn: userLimit.resetAt - now,
  };
}

/**
 * Reset rate limit for specific user and action (admin function)
 */
export function resetRateLimit(userId: number, action: keyof typeof RATE_LIMITS): void {
  const key = `${userId}:${action}`;
  rateLimits.delete(key);
  console.log(`[Rate Limiter] Reset limit for user ${userId}, action ${action}`);
}

/**
 * Reset all limits for user (admin function)
 */
export function resetAllLimitsForUser(userId: number): void {
  let deletedCount = 0;
  for (const [key] of rateLimits.entries()) {
    if (key.startsWith(`${userId}:`)) {
      rateLimits.delete(key);
      deletedCount++;
    }
  }
  console.log(`[Rate Limiter] Reset ${deletedCount} limits for user ${userId}`);
}

/**
 * Get statistics about all rate limits (monitoring)
 */
export function getRateLimiterStats(): {
  totalUsers: number;
  totalLimits: number;
  activeUsers: number;
  topUsers: Array<{ userId: number; requests: number }>;
} {
  const now = Date.now();
  const userStats = new Map<number, number>();
  let activeCount = 0;
  
  for (const [key, limit] of rateLimits.entries()) {
    if (now < limit.resetAt) {
      activeCount++;
      const userId = parseInt(key.split(':')[0]);
      userStats.set(userId, (userStats.get(userId) || 0) + limit.count);
    }
  }
  
  const topUsers = Array.from(userStats.entries())
    .map(([userId, requests]) => ({ userId, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
  
  return {
    totalUsers: new Set(Array.from(rateLimits.keys()).map(k => k.split(':')[0])).size,
    totalLimits: rateLimits.size,
    activeUsers: activeCount,
    topUsers,
  };
}

/**
 * Cleanup expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredLimits(): void {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, limit] of rateLimits.entries()) {
    if (now >= limit.resetAt) {
      rateLimits.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[Rate Limiter] Cleaned up ${deletedCount} expired entries`);
  }
}

/**
 * Format time left in human-readable format
 */
function formatTimeLeft(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} ${getHoursWord(hours)}`;
  } else if (minutes > 0) {
    return `${minutes} ${getMinutesWord(minutes)}`;
  } else {
    return `${seconds} ${getSecondsWord(seconds)}`;
  }
}

/**
 * Get correct Russian word form for hours
 */
function getHoursWord(hours: number): string {
  if (hours % 10 === 1 && hours % 100 !== 11) {
    return 'час';
  } else if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) {
    return 'часа';
  } else {
    return 'часов';
  }
}

/**
 * Get correct Russian word form for minutes
 */
function getMinutesWord(minutes: number): string {
  if (minutes % 10 === 1 && minutes % 100 !== 11) {
    return 'минуту';
  } else if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100)) {
    return 'минуты';
  } else {
    return 'минут';
  }
}

/**
 * Get correct Russian word form for seconds
 */
function getSecondsWord(seconds: number): string {
  if (seconds % 10 === 1 && seconds % 100 !== 11) {
    return 'секунду';
  } else if ([2, 3, 4].includes(seconds % 10) && ![12, 13, 14].includes(seconds % 100)) {
    return 'секунды';
  } else {
    return 'секунд';
  }
}

/**
 * Start periodic cleanup (run every hour)
 */
export function startRateLimiterCleanup(): void {
  console.log('[Rate Limiter] Starting periodic cleanup...');
  
  // Initial cleanup
  cleanupExpiredLimits();
  
  // Run every hour
  setInterval(() => {
    cleanupExpiredLimits();
  }, 60 * 60 * 1000);
}

/**
 * Log rate limiter statistics (for monitoring)
 */
export function logRateLimiterStats(): void {
  const stats = getRateLimiterStats();
  console.log('[Rate Limiter] Stats:', {
    totalUsers: stats.totalUsers,
    totalLimits: stats.totalLimits,
    activeUsers: stats.activeUsers,
    memoryUsage: `${(rateLimits.size * 100 / 1024).toFixed(2)} KB`,
  });
  
  if (stats.topUsers.length > 0) {
    console.log('[Rate Limiter] Top users by request count:', stats.topUsers.slice(0, 5));
  }
}
