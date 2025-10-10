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
    const { products, total, hasMore } = await getUserProductsPaginated(userId, page, 6);

    if (products.length === 0) {
      return {
        text: '📦 У тебя пока нет сохраненных продуктов.\n\nДобавь свой первый продукт с КБЖУ для быстрого использования!',
        keyboard: {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Добавить продукт', callback_data: 'add_product' }],
              [{ text: '🔙 Назад', callback_data: 'add_food' }],
            ],
          },
        },
      };
    }

    // Создаем кнопки для продуктов (по 2 в ряд) с inline keyboard
    const productButtons = [];
    for (let i = 0; i < products.length; i += 2) {
      const row = [];
      row.push({ text: `🍽 ${products[i].name}`, callback_data: `product_${products[i].id}` });
      if (i + 1 < products.length) {
        row.push({ text: `🍽 ${products[i + 1].name}`, callback_data: `product_${products[i + 1].id}` });
      }
      productButtons.push(row);
    }

    // Навигация
    const navigationRow = [];
    if (page > 0) {
      navigationRow.push({ text: '⬅️', callback_data: `products_page_${page - 1}` });
    }
    if (hasMore) {
      navigationRow.push({ text: '➡️', callback_data: `products_page_${page + 1}` });
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...productButtons,
          ...(navigationRow.length > 0 ? [navigationRow] : []),
          [{ text: '➕ Добавить продукт', callback_data: 'add_product' }],
          [{ text: '🔙 Назад', callback_data: 'add_food' }],
        ],
      },
    };

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
        keyboard: {
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ К моим продуктам', callback_data: 'user_products' }],
            ],
          },
        },
      };
    }

    const text = `🍽 <b>${product.name}</b> (на 100г)\n\n` +
      `🔥 Калории: ${product.calories} ккал\n` +
      `🥩 Белки: ${product.protein}г\n` +
      `🧈 Жиры: ${product.fat}г\n` +
      `🍞 Углеводы: ${product.carbs}г\n\n` +
      `Сколько грамм <b>${product.name}</b> ты съел?\n` +
      `Введи вес в граммах (например: 150)`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '50г', callback_data: `product_weight_${productId}_50` },
            { text: '100г', callback_data: `product_weight_${productId}_100` },
            { text: '150г', callback_data: `product_weight_${productId}_150` },
          ],
          [
            { text: '200г', callback_data: `product_weight_${productId}_200` },
            { text: '250г', callback_data: `product_weight_${productId}_250` },
            { text: '300г', callback_data: `product_weight_${productId}_300` },
          ],
          [{ text: '❌ Удалить продукт', callback_data: `delete_product_${productId}` }],
          [{ text: '◀️ К моим продуктам', callback_data: 'user_products' }],
        ],
      },
    };

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

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'cancel_add_product' }],
      ],
    },
  };

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

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Отмена', callback_data: 'cancel_add_product' }],
      ],
    },
  };

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
    const product = await addUserProduct({
      user_id: userId,
      name: productName,
      calories: kbzhu.calories,
      protein: kbzhu.protein,
      fat: kbzhu.fat,
      carbs: kbzhu.carbs,
    });

    if (!product) {
      throw new Error('Failed to add product');
    }

    const text = 
      '✅ <b>Продукт успешно добавлен!</b>\n\n' +
      `🍽 <b>${product.name}</b> (на 100г)\n` +
      `🔥 ${product.calories} ккал\n` +
      `🥩 Б: ${product.protein}г\n` +
      `🧈 Ж: ${product.fat}г\n` +
      `🍞 У: ${product.carbs}г\n\n` +
      'Теперь ты можешь быстро добавить этот продукт из меню "Продукты"!';

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '◀️ К моим продуктам', callback_data: 'user_products' }],
        ],
      },
    };

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
        keyboard: {
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ К моим продуктам', callback_data: 'user_products' }],
            ],
          },
        },
      };
    }

    const text = '✅ Продукт успешно удален!';
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '◀️ К моим продуктам', callback_data: 'user_products' }],
        ],
      },
    };

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

