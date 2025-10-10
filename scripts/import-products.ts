/**
 * Script to parse tablica_caloriynosti.md and import products into database
 * Run with: npx ts-node scripts/import-products.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/database/client';

interface Product {
  name: string;
  category: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

const CATEGORY_MARKERS = [
  'Хлебобулочные изделия, мука, крупы, бобовые',
  'Молочные продукты',
  'Мясные продукты, птица',
  'Колбасные изделия, мясные консервы',
  'Рыба и морепродукты',
  'Рыба соленая, копченая, вяленая, икра',
  'Консервы рыбные',
  'Яйцепродукты',
  'Масла, жиры и жировые продукты',
  'Овощи, картофель, зелень, грибы, овощные консервы',
  'Грибы',
  'Овощные консервы',
  'Фрукты, ягоды, бахчевые',
  'Орехи, семена, сухофрукты',
  'Сахар, сладкое и кондитерские изделия',
  'Соки, напитки безалкогольные',
  'Напитки алкогольные'
];

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function parseNutritionValue(value: string): number {
  // Handle ranges like "7,5-7,6" -> take average
  if (value.includes('-')) {
    const [min, max] = value.split('-').map(v => parseFloat(v.replace(',', '.')));
    return (min + max) / 2;
  }
  
  // Handle "следы" (traces) -> 0
  if (value.toLowerCase().includes('след') || value === '-') {
    return 0;
  }
  
  // Normal number
  return parseFloat(value.replace(',', '.')) || 0;
}

function parseProductLine(line: string, category: string): Product | null {
  // Skip empty lines, headers, and category lines
  if (!line.trim() || 
      line.includes('Продукты') || 
      line.includes('Белки,') ||
      line.includes('Жиры,') ||
      line.includes('Углеводы') ||
      line.includes('Энергия') ||
      CATEGORY_MARKERS.includes(line.trim())) {
    return null;
  }

  // Try to parse the line
  // Format: "Название продукта белки жиры углеводы калории"
  const parts = line.split(/\s+/);
  
  if (parts.length < 4) {
    return null;
  }

  // Last 4 numbers are: protein, fat, carbs, calories
  const calories = parts[parts.length - 1];
  const carbs = parts[parts.length - 2];
  const fat = parts[parts.length - 3];
  const protein = parts[parts.length - 4];

  // Check if last 4 parts look like numbers
  const numbersRegex = /^[\d,\.\-]+$/;
  if (!numbersRegex.test(protein) || !numbersRegex.test(fat) || 
      !numbersRegex.test(carbs) || !numbersRegex.test(calories)) {
    return null;
  }

  // Everything before is the product name
  const name = parts.slice(0, parts.length - 4).join(' ').trim();
  
  if (!name || name.length < 2) {
    return null;
  }

  return {
    name,
    category,
    protein: parseNutritionValue(protein),
    fat: parseNutritionValue(fat),
    carbs: parseNutritionValue(carbs),
    calories: Math.round(parseNutritionValue(calories))
  };
}

async function importProducts() {
  try {
    console.log('🚀 Starting product import...');

    // Read the file
    const filePath = path.join(__dirname, '../tablica_caloriynosti.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentCategory = 'Общие';
    const products: Product[] = [];
    let skippedLines = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this is a category marker
      if (CATEGORY_MARKERS.includes(trimmedLine)) {
        currentCategory = trimmedLine;
        console.log(`\n📁 Category: ${currentCategory}`);
        continue;
      }

      // Try to parse as product
      const product = parseProductLine(trimmedLine, currentCategory);
      if (product) {
        products.push(product);
      } else if (trimmedLine && !trimmedLine.includes('Таблица') && !trimmedLine.includes('Категории')) {
        skippedLines++;
      }
    }

    console.log(`\n✅ Parsed ${products.length} products`);
    console.log(`⚠️  Skipped ${skippedLines} lines`);

    // Clear existing data
    console.log('\n🗑️  Clearing existing products...');
    await pool.query('DELETE FROM products_nutrition');

    // Insert products
    console.log('💾 Inserting products into database...');
    
    let inserted = 0;
    let failed = 0;

    for (const product of products) {
      try {
        await pool.query(
          `INSERT INTO products_nutrition (name, name_normalized, category, protein, fat, carbs, calories)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            product.name,
            normalizeProductName(product.name),
            product.category,
            product.protein,
            product.fat,
            product.carbs,
            product.calories
          ]
        );
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  Inserted ${inserted}/${products.length}...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to insert "${product.name}":`, error);
        failed++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Failed: ${failed}`);

    // Show some stats
    const stats = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM products_nutrition 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Products by category:');
    stats.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importProducts();

