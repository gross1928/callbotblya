import { supabase } from './client';
import type { UserProduct } from '../types';

/**
 * Получить продукты пользователя
 */
export async function getUserProducts(userId: number): Promise<UserProduct[]> {
  try {
    const { data, error } = await supabase
      .from('user_products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user products:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserProducts:', error);
    throw error;
  }
}

/**
 * Получить продукты пользователя с пагинацией
 */
export async function getUserProductsPaginated(
  userId: number,
  page: number = 0,
  pageSize: number = 8
): Promise<{ products: UserProduct[]; total: number; hasMore: boolean }> {
  try {
    // Получаем общее количество продуктов
    const { count, error: countError } = await supabase
      .from('user_products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting user products:', countError);
      throw countError;
    }

    const total = count || 0;

    // Получаем продукты для текущей страницы
    const { data, error } = await supabase
      .from('user_products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching user products:', error);
      throw error;
    }

    const products = data || [];
    const hasMore = (page + 1) * pageSize < total;

    return { products, total, hasMore };
  } catch (error) {
    console.error('Error in getUserProductsPaginated:', error);
    throw error;
  }
}

/**
 * Получить продукт по ID
 */
export async function getUserProduct(userId: number, productId: number): Promise<UserProduct | null> {
  try {
    const { data, error } = await supabase
      .from('user_products')
      .select('*')
      .eq('user_id', userId)
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching user product:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProduct:', error);
    return null;
  }
}

/**
 * Добавить новый продукт
 */
export async function addUserProduct(
  userId: number,
  name: string,
  calories: number,
  protein: number,
  fat: number,
  carbs: number
): Promise<UserProduct> {
  try {
    const { data, error } = await supabase
      .from('user_products')
      .insert({
        user_id: userId,
        name,
        calories,
        protein,
        fat,
        carbs,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding user product:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in addUserProduct:', error);
    throw error;
  }
}

/**
 * Удалить продукт
 */
export async function deleteUserProduct(userId: number, productId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_products')
      .delete()
      .eq('user_id', userId)
      .eq('id', productId);

    if (error) {
      console.error('Error deleting user product:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteUserProduct:', error);
    return false;
  }
}

/**
 * Обновить продукт
 */
export async function updateUserProduct(
  userId: number,
  productId: number,
  updates: Partial<Pick<UserProduct, 'name' | 'calories' | 'protein' | 'fat' | 'carbs'>>
): Promise<UserProduct | null> {
  try {
    const { data, error } = await supabase
      .from('user_products')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user product:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProduct:', error);
    return null;
  }
}

