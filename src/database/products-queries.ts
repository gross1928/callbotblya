import { supabase } from './client';
import type { UserProduct } from '../types';

// ============================================
// NUTRITION DATABASE (700+ products)
// ============================================

export interface ProductNutrition {
  id: number;
  name: string;
  category: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

export interface ProductSearchResult extends ProductNutrition {
  similarity?: number;
}

/**
 * Search for a product by name using fuzzy matching
 */
export async function searchProduct(productName: string, limit: number = 5): Promise<ProductSearchResult[]> {
  try {
    const normalized = productName.toLowerCase().trim();
    
    // Try exact match first
    const { data: exactMatch, error: exactError } = await supabase
      .from('products_nutrition')
      .select('id, name, category, protein, fat, carbs, calories')
      .eq('name_normalized', normalized)
      .limit(1);
    
    if (exactError) {
      console.error('[searchProduct] Exact match error:', exactError);
    }
    
    if (exactMatch && exactMatch.length > 0) {
      console.log(`[searchProduct] Exact match found for "${productName}": ${exactMatch[0].name}`);
      return exactMatch.map(row => ({ ...row, similarity: 1.0 }));
    }

    // Fallback: search by partial match (contains)
    const { data: fuzzyMatch, error: fuzzyError } = await supabase
      .from('products_nutrition')
      .select('id, name, category, protein, fat, carbs, calories')
      .ilike('name_normalized', `%${normalized}%`)
      .limit(limit);

    if (fuzzyError) {
      console.error('[searchProduct] Fuzzy match error:', fuzzyError);
      return [];
    }

    if (fuzzyMatch && fuzzyMatch.length > 0) {
      console.log(`[searchProduct] Fuzzy matches for "${productName}":`, 
        fuzzyMatch.map(r => r.name));
      // Calculate simple similarity based on length difference
      return fuzzyMatch.map(row => ({
        ...row,
        similarity: 1 - (Math.abs(row.name.length - productName.length) / Math.max(row.name.length, productName.length))
      }));
    } else {
      console.log(`[searchProduct] No matches found for "${productName}"`);
    }

    return [];
  } catch (error) {
    console.error('[searchProduct] Error searching product:', error);
    return [];
  }
}

/**
 * Get product by exact ID
 */
export async function getProductById(id: number): Promise<ProductNutrition | null> {
  try {
    const { data, error } = await supabase
      .from('products_nutrition')
      .select('id, name, category, protein, fat, carbs, calories')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('[getProductById] Error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[getProductById] Error:', error);
    return null;
  }
}

/**
 * Calculate nutrition for a specific weight of product
 */
export function calculateNutritionForWeight(
  product: ProductNutrition,
  weightInGrams: number
): {
  name: string;
  weight: number;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
} {
  const ratio = weightInGrams / 100; // Products are per 100g

  return {
    name: product.name,
    weight: weightInGrams,
    protein: Math.round(product.protein * ratio * 10) / 10,
    fat: Math.round(product.fat * ratio * 10) / 10,
    carbs: Math.round(product.carbs * ratio * 10) / 10,
    calories: Math.round(product.calories * ratio)
  };
}

/**
 * Get all products in a category
 */
export async function getProductsByCategory(category: string): Promise<ProductNutrition[]> {
  try {
    const { data, error } = await supabase
      .from('products_nutrition')
      .select('id, name, category, protein, fat, carbs, calories')
      .eq('category', category)
      .order('name');
    
    if (error) {
      console.error('[getProductsByCategory] Error:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('[getProductsByCategory] Error:', error);
    return [];
  }
}

/**
 * Get total count of products in database
 */
export async function getProductsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('products_nutrition')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('[getProductsCount] Error:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('[getProductsCount] Error:', error);
    return 0;
  }
}

// ============================================
// USER PRODUCTS (custom user products)
// ============================================

/**
 * Get user products with pagination
 */
export async function getUserProductsPaginated(
  userId: number,
  page: number = 0,
  limit: number = 6
): Promise<{ products: UserProduct[]; total: number; hasMore: boolean }> {
  try {
    const from = page * limit;
    const to = from + limit - 1;

    // Get products with count
    const { data, error, count } = await supabase
      .from('user_products')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[getUserProductsPaginated] Error:', error);
      return { products: [], total: 0, hasMore: false };
    }

    const total = count || 0;
    const hasMore = to < total - 1;

    return {
      products: data || [],
      total,
      hasMore,
    };
  } catch (error) {
    console.error('[getUserProductsPaginated] Error:', error);
    return { products: [], total: 0, hasMore: false };
  }
}

/**
 * Get single user product by ID
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
      console.error('[getUserProduct] Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[getUserProduct] Error:', error);
    return null;
  }
}

/**
 * Add new user product
 */
export async function addUserProduct(product: Omit<UserProduct, 'id' | 'created_at'>): Promise<UserProduct | null> {
  try {
    const { data, error } = await supabase
      .from('user_products')
      .insert([product])
      .select()
      .single();

    if (error) {
      console.error('[addUserProduct] Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[addUserProduct] Error:', error);
    return null;
  }
}

/**
 * Delete user product
 */
export async function deleteUserProduct(userId: number, productId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_products')
      .delete()
      .eq('user_id', userId)
      .eq('id', productId);

    if (error) {
      console.error('[deleteUserProduct] Error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[deleteUserProduct] Error:', error);
    return false;
  }
}
