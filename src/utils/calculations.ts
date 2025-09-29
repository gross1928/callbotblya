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
 */
export function calculateTargetCalories(tdee: number, goal: string, targetDateMonths?: number, targetWeight?: number, currentWeight?: number): number {
  let deficit = 0;
  let surplus = 0;
  
  if (goal === 'lose' && targetDateMonths && targetWeight && currentWeight) {
    const weightToLose = currentWeight - targetWeight;
    const weightLossPerMonth = weightToLose / targetDateMonths;
    const weightLossPerWeek = weightLossPerMonth / 4.33; // weeks per month
    
    // 1kg = ~7700 calories, so for aggressive weight loss
    deficit = Math.round(weightLossPerWeek * 1100); // 1100 cal per 1kg/week
    deficit = Math.min(deficit, 1000); // Max 1000 cal deficit for safety
    deficit = Math.max(deficit, 300); // Min 300 cal deficit
  } else if (goal === 'gain' && targetDateMonths && targetWeight && currentWeight) {
    const weightToGain = targetWeight - currentWeight;
    const weightGainPerMonth = weightToGain / targetDateMonths;
    const weightGainPerWeek = weightGainPerMonth / 4.33;
    
    // 1kg = ~7700 calories, so for muscle gain
    surplus = Math.round(weightGainPerWeek * 700); // 700 cal per 1kg/week
    surplus = Math.min(surplus, 800); // Max 800 cal surplus
    surplus = Math.max(surplus, 200); // Min 200 cal surplus
  } else {
    // Fallback to standard values
    switch (goal) {
      case 'lose':
        deficit = 500;
        break;
      case 'gain':
        surplus = 300;
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
 * Calculate target macronutrients
 */
export function calculateTargetMacros(targetCalories: number, goal: string) {
  let proteinRatio: number;
  let fatRatio: number;
  let carbsRatio: number;

  switch (goal) {
    case 'lose':
      // Higher protein for weight loss
      proteinRatio = 0.35;
      fatRatio = 0.25;
      carbsRatio = 0.40;
      break;
    case 'gain':
      // Higher carbs for muscle gain
      proteinRatio = 0.25;
      fatRatio = 0.25;
      carbsRatio = 0.50;
      break;
    case 'maintain':
    default:
      // Balanced macros
      proteinRatio = 0.30;
      fatRatio = 0.25;
      carbsRatio = 0.45;
      break;
  }

  return {
    protein: Math.round((targetCalories * proteinRatio) / 4), // 4 cal/g
    fat: Math.round((targetCalories * fatRatio) / 9), // 9 cal/g
    carbs: Math.round((targetCalories * carbsRatio) / 4), // 4 cal/g
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
