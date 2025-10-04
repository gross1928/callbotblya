import { Markup } from 'telegraf';
import type { UserProduct } from '../types';
import {
  getUserProductsPaginated,
  getUserProduct,
  addUserProduct,
  deleteUserProduct,
} from '../database/products-queries';

/**
 * Показать список продуктов пользователя с пагинацией
 */
export async function showUserProductsMenu(
  userId: number,
  page: number = 0
): Promise<{ text: string; keyboard: any }> {
  try {
    const { products, total, hasMore } = await getUserProductsPaginated(userId, page, 8);

    if (products.length === 0) {
      return {
        text: '📦 У тебя пока нет сохраненных продуктов.\n\nНажми "+ Добавить продукт" чтобы создать свой первый продукт!',
        keyboard: Markup.keyboard([
          ['➕ Добавить продукт'],
          ['◀️ Назад к добавлению еды'],
        ]).resize(),
      };
    }

    // Создаем кнопки для продуктов (по 2 в ряд)
    const productButtons = [];
    for (let i = 0; i < products.length; i += 2) {
      const row = [];
      row.push(`🍽 ${products[i].name}`);
      if (i + 1 < products.length) {
        row.push(`🍽 ${products[i + 1].name}`);
      }
      productButtons.push(row);
    }

    // Навигация
    const navigationRow = [];
    if (page > 0) {
      navigationRow.push('⬅️');
    }
    navigationRow.push(`Стр ${page + 1} / ${Math.ceil(total / 8)}`);
    if (hasMore) {
      navigationRow.push('➡️');
    }

    const keyboard = Markup.keyboard([
      ...productButtons,
      navigationRow,
      ['➕ Добавить продукт'],
      ['◀️ Назад к добавлению еды'],
    ]).resize();

    const text = `📦 Твои продукты (${total}):\n\nВыбери продукт чтобы использовать его, или добавь новый!`;

    return { text, keyboard };
  } catch (error) {
    console.error('Error showing user products menu:', error);
    throw error;
  }
}

/**
 * Показать детали продукта
 */
export async function showProductDetails(
  userId: number,
  productId: number
): Promise<{ text: string; keyboard: any }> {
  try {
    const product = await getUserProduct(userId, productId);

    if (!product) {
      return {
        text: '❌ Продукт не найден',
        keyboard: Markup.keyboard([['◀️ К моим продуктам']]).resize(),
      };
    }

    const text = `🍽 <b>${product.name}</b> (на 100г)\n\n` +
      `🔥 Калории: ${product.calories} ккал\n` +
      `🥩 Белки: ${product.protein}г\n` +
      `🧈 Жиры: ${product.fat}г\n` +
      `🍞 Углеводы: ${product.carbs}г\n\n` +
      `Сколько грамм <b>${product.name}</b> ты съел?\n` +
      `Введи вес в граммах (например: 150)`;

    const keyboard = Markup.keyboard([
      ['50г', '100г', '150г'],
      ['200г', '250г', '300г'],
      ['❌ Удалить продукт'],
      ['◀️ К моим продуктам'],
    ]).resize();

    return { text, keyboard };
  } catch (error) {
    console.error('Error showing product details:', error);
    throw error;
  }
}

/**
 * Обработать добавление продукта - шаг 1: название
 */
export async function handleAddProductStart(): Promise<{ text: string; keyboard: any }> {
  const text = 
    '➕ <b>Добавление нового продукта</b>\n\n' +
    '1️⃣ Введи название продукта:\n' +
    'Например: "Сыр Голландский" или "Греча вареная"\n\n' +
    'Старайся указывать конкретное название, чтобы потом было проще найти!';

  const keyboard = Markup.keyboard([['❌ Отмена']]).resize();

  return { text, keyboard };
}

/**
 * Обработать добавление продукта - шаг 2: КБЖУ
 */
export async function handleAddProductName(productName: string): Promise<{ text: string; keyboard: any }> {
  const text = 
    `➕ <b>Добавление: ${productName}</b>\n\n` +
    '2️⃣ Теперь введи КБЖУ на 100г в формате:\n' +
    '<code>калории\nбелки\nжиры\nуглеводы</code>\n\n' +
    'Пример:\n' +
    '<code>220\n13\n5\n21</code>\n\n' +
    'Каждая цифра с новой строки!';

  const keyboard = Markup.keyboard([['❌ Отмена']]).resize();

  return { text, keyboard };
}

/**
 * Парсинг КБЖУ из текста
 */
export function parseKBZHU(text: string): { calories: number; protein: number; fat: number; carbs: number } | null {
  // Убираем все пробелы и переводы строк, разбиваем по символам новой строки или пробелам
  const lines = text.trim().split(/[\n\s]+/).filter(line => line.length > 0);

  if (lines.length !== 4) {
    return null;
  }

  const values = lines.map(line => {
    const num = parseFloat(line.replace(',', '.'));
    return isNaN(num) ? null : num;
  });

  if (values.some(v => v === null || v < 0)) {
    return null;
  }

  return {
    calories: Math.round(values[0]!),
    protein: Math.round(values[1]! * 10) / 10,
    fat: Math.round(values[2]! * 10) / 10,
    carbs: Math.round(values[3]! * 10) / 10,
  };
}

/**
 * Завершить добавление продукта
 */
export async function handleAddProductComplete(
  userId: number,
  productName: string,
  kbzhu: { calories: number; protein: number; fat: number; carbs: number }
): Promise<{ text: string; keyboard: any; product: UserProduct }> {
  try {
    const product = await addUserProduct(
      userId,
      productName,
      kbzhu.calories,
      kbzhu.protein,
      kbzhu.fat,
      kbzhu.carbs
    );

    const text = 
      '✅ <b>Продукт успешно добавлен!</b>\n\n' +
      `🍽 <b>${product.name}</b> (на 100г)\n` +
      `🔥 ${product.calories} ккал\n` +
      `🥩 Б: ${product.protein}г\n` +
      `🧈 Ж: ${product.fat}г\n` +
      `🍞 У: ${product.carbs}г\n\n` +
      'Теперь ты можешь быстро добавить этот продукт из меню "Продукты"!';

    const keyboard = Markup.keyboard([
      ['◀️ К моим продуктам'],
      ['🍽 Добавить еду'],
    ]).resize();

    return { text, keyboard, product };
  } catch (error) {
    console.error('Error completing add product:', error);
    throw error;
  }
}

/**
 * Удалить продукт
 */
export async function handleDeleteProduct(
  userId: number,
  productId: number
): Promise<{ text: string; keyboard: any }> {
  try {
    const success = await deleteUserProduct(userId, productId);

    if (!success) {
      return {
        text: '❌ Не удалось удалить продукт',
        keyboard: Markup.keyboard([['◀️ К моим продуктам']]).resize(),
      };
    }

    const text = '✅ Продукт успешно удален!';
    const keyboard = Markup.keyboard([['◀️ К моим продуктам']]).resize();

    return { text, keyboard };
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

/**
 * Создать FoodAnalysis из продукта и веса
 */
export function createFoodAnalysisFromProduct(
  product: UserProduct,
  weightGrams: number
): {
  name: string;
  ingredients: string[];
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
} {
  const multiplier = weightGrams / 100;

  return {
    name: `${product.name} (${weightGrams}г)`,
    ingredients: [product.name],
    weight: weightGrams,
    calories: Math.round(product.calories * multiplier),
    protein: Math.round(product.protein * multiplier * 10) / 10,
    fat: Math.round(product.fat * multiplier * 10) / 10,
    carbs: Math.round(product.carbs * multiplier * 10) / 10,
  };
}

