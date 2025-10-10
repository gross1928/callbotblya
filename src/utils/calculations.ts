import type { UserProfile, ActivityLevel } from '../types';
import { config } from '../config';

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export function calculateBMR(profile: Pick<UserProfile, 'age' | 'gender' | 'height' | 'weight'>): number {
  const { age, gender, height, weight } = profile;
  
  // Mifflin-St Jeor Equation
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
  
  return Math.round(bmr);
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = config.activityMultipliers[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Calculate target calories based on goal and timeframe
 * Using moderate deficit/surplus (300-500 kcal) for sustainable progress
 */
export function calculateTargetCalories(tdee: number, goal: string, targetDateMonths?: number, targetWeight?: number, currentWeight?: number): number {
  let deficit = 0;
  let surplus = 0;
  
  if (goal === 'lose' && targetDateMonths && targetWeight && currentWeight) {
    const weightToLose = currentWeight - targetWeight;
    const weightLossPerMonth = weightToLose / targetDateMonths;
    const weightLossPerWeek = weightLossPerMonth / 4.33; // weeks per month
    
    // 1kg = ~7700 calories, moderate deficit for muscle preservation
    deficit = Math.round(weightLossPerWeek * 1100); // 1100 cal per 1kg/week
    deficit = Math.min(deficit, 500); // Max 500 cal deficit (trainer recommendation)
    deficit = Math.max(deficit, 300); // Min 300 cal deficit
  } else if (goal === 'gain' && targetDateMonths && targetWeight && currentWeight) {
    const weightToGain = targetWeight - currentWeight;
    const weightGainPerMonth = weightToGain / targetDateMonths;
    const weightGainPerWeek = weightGainPerMonth / 4.33;
    
    // Moderate surplus to minimize fat gain
    surplus = Math.round(weightGainPerWeek * 700); // 700 cal per 1kg/week
    surplus = Math.min(surplus, 500); // Max 500 cal surplus (trainer recommendation)
    surplus = Math.max(surplus, 300); // Min 300 cal surplus
  } else {
    // Fallback to standard moderate values (300-500 kcal range)
    switch (goal) {
      case 'lose':
        deficit = 400; // Moderate deficit
        break;
      case 'gain':
        surplus = 400; // Moderate surplus
        break;
    }
  }
  
  switch (goal) {
    case 'lose':
      return Math.round(tdee - deficit);
    case 'gain':
      return Math.round(tdee + surplus);
    case 'maintain':
    default:
      return tdee;
  }
}

/**
 * Calculate target macronutrients based on body weight
 * Using scientifically proven formulas from professional trainer
 */
export function calculateTargetMacros(targetCalories: number, goal: string, weight: number) {
  let proteinGrams: number;
  let fatGrams: number;
  let carbsGrams: number;

  // Protein: always 1.6g per kg (proven optimal for all goals)
  proteinGrams = Math.round(weight * 1.6);
  
  switch (goal) {
    case 'lose':
      // Fat: 0.8g per kg
      fatGrams = Math.round(weight * 0.8);
      // Carbs: start with 5g per kg (can be reduced over time)
      // Using 4g for moderate deficit to avoid too aggressive cuts
      carbsGrams = Math.round(weight * 4);
      break;
      
    case 'gain':
      // Fat: 1g per kg (slightly higher for muscle gain)
      fatGrams = Math.round(weight * 1.0);
      // Carbs: 6-9g per kg (starting with 6g for moderate surplus)
      carbsGrams = Math.round(weight * 6);
      break;
      
    case 'maintain':
    default:
      // Fat: 0.8g per kg
      fatGrams = Math.round(weight * 0.8);
      // Carbs: 5g per kg (maintenance level)
      carbsGrams = Math.round(weight * 5);
      break;
  }

  // Verify total calories match (adjust carbs if needed)
  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  
  // Recalculate carbs based on remaining calories
  const adjustedCarbs = Math.max(Math.round(remainingCalories / 4), 0);
  
  return {
    protein: proteinGrams,
    fat: fatGrams,
    carbs: adjustedCarbs,
  };
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

/**
 * Generate progress bar emoji
 */
export function generateProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Generate water progress bar with bricks
 */
export function generateWaterProgressBar(percentage: number, length: number = 20): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}

/**
 * Generate food progress bar with bricks
 */
export function generateFoodProgressBar(percentage: number, length: number = 15): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}

/**
 * Generate macro progress bar with colored bricks
 */
export function generateMacroProgressBar(percentage: number, color: 'red' | 'blue' | 'yellow', length: number = 12): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  let filledEmoji = '';
  switch (color) {
    case 'red':
      filledEmoji = '🟥'; // Protein
      break;
    case 'blue':
      filledEmoji = '🟦'; // Carbs
      break;
    case 'yellow':
      filledEmoji = '🟨'; // Fat
      break;
  }
  
  return filledEmoji.repeat(filled) + '⬜'.repeat(empty);
}

/**
 * Format weight for display
 */
export function formatWeight(weight: number): string {
  return `${weight.toFixed(1)} кг`;
}

/**
 * Format calories for display
 */
export function formatCalories(calories: number): string {
  return `${calories} ккал`;
}

/**
 * Format macros for display
 */
export function formatMacros(macros: { protein: number; fat: number; carbs: number }): string {
  return `Б: ${macros.protein}г | Ж: ${macros.fat}г | У: ${macros.carbs}г`;
}

/**
 * Format water amount for display
 */
export function formatWater(ml: number): string {
  if (ml >= 1000) {
    return `${(ml / 1000).toFixed(1)}л`;
  }
  return `${ml}мл`;
}
