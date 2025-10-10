import { pool } from './client';

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
    const exactMatch = await pool.query<ProductNutrition>(
      `SELECT id, name, category, protein, fat, carbs, calories
       FROM products_nutrition
       WHERE name_normalized = $1
       LIMIT 1`,
      [normalized]
    );
    
    if (exactMatch.rows.length > 0) {
      console.log(`[searchProduct] Exact match found for "${productName}": ${exactMatch.rows[0].name}`);
      return exactMatch.rows.map(row => ({ ...row, similarity: 1.0 }));
    }

    // Try fuzzy match using trigram similarity
    const fuzzyMatch = await pool.query<ProductNutrition & { similarity: number }>(
      `SELECT id, name, category, protein, fat, carbs, calories,
              similarity(name_normalized, $1) as similarity
       FROM products_nutrition
       WHERE similarity(name_normalized, $1) > 0.3
       ORDER BY similarity DESC
       LIMIT $2`,
      [normalized, limit]
    );

    if (fuzzyMatch.rows.length > 0) {
      console.log(`[searchProduct] Fuzzy matches for "${productName}":`, 
        fuzzyMatch.rows.map(r => `${r.name} (${(r.similarity * 100).toFixed(0)}%)`));
    } else {
      console.log(`[searchProduct] No matches found for "${productName}"`);
    }

    return fuzzyMatch.rows;
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
    const result = await pool.query<ProductNutrition>(
      'SELECT id, name, category, protein, fat, carbs, calories FROM products_nutrition WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
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
    const result = await pool.query<ProductNutrition>(
      'SELECT id, name, category, protein, fat, carbs, calories FROM products_nutrition WHERE category = $1 ORDER BY name',
      [category]
    );
    return result.rows;
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
    const result = await pool.query('SELECT COUNT(*) as count FROM products_nutrition');
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('[getProductsCount] Error:', error);
    return 0;
  }
}
