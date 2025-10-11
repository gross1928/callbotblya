/**
 * Script to parse tablica_caloriynosti.md and import products into Supabase
 * Run with: npx ts-node scripts/import-products-supabase.ts
 * 
 * Requirements:
 * - SUPABASE_URL and SUPABASE_ANON_KEY in .env
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

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
    .replace(/\s+/g, ' ')
    .replace(/["«»]/g, ''); // Remove quotes
}

function parseNutritionValue(value: string): number {
  // Handle ranges like "7,5-7,6" -> take average
  if (value.includes('-')) {
    const [min, max] = value.split('-').map(v => parseFloat(v.replace(',', '.')));
    if (!isNaN(min) && !isNaN(max)) {
      return (min + max) / 2;
    }
  }
  
  // Handle "следы" (traces) -> 0
  if (value.toLowerCase().includes('след') || value === '-' || value === '') {
    return 0;
  }
  
  // Normal number
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : num;
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

  // Check if last 4 parts look like numbers (allowing commas, dots, dashes)
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
    console.log('🚀 Начинаем импорт продуктов...');

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
        console.log(`\n📁 Категория: ${currentCategory}`);
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

    console.log(`\n✅ Спарсено ${products.length} продуктов`);
    console.log(`⚠️  Пропущено ${skippedLines} строк`);

    // Show first few products as sample
    console.log('\n📋 Примеры продуктов:');
    products.slice(0, 5).forEach(p => {
      console.log(`  • ${p.name} (${p.category}) - ${p.calories} ккал`);
    });

    // Clear existing data
    console.log('\n🗑️  Очищаем существующие продукты...');
    const { error: deleteError } = await supabase
      .from('products_nutrition')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (deleteError && deleteError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Ошибка очистки:', deleteError);
      throw deleteError;
    }

    // Insert products in batches
    console.log('\n💾 Вставляем продукты в базу данных...');
    
    const BATCH_SIZE = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      const productsData = batch.map(product => ({
        name: product.name,
        name_normalized: normalizeProductName(product.name),
        category: product.category,
        protein: product.protein,
        fat: product.fat,
        carbs: product.carbs,
        calories: product.calories
      }));

      const { error } = await supabase
        .from('products_nutrition')
        .insert(productsData);

      if (error) {
        console.error(`  ❌ Ошибка вставки батча ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        failed += batch.length;
      } else {
        inserted += batch.length;
        console.log(`  ✓ Вставлено ${inserted}/${products.length}...`);
      }
    }

    console.log(`\n✅ Импорт завершен!`);
    console.log(`   Вставлено: ${inserted}`);
    console.log(`   Ошибок: ${failed}`);

    // Show some stats
    const { data: stats } = await supabase
      .from('products_nutrition')
      .select('category')
      .then(result => {
        if (!result.data) return { data: [] };
        
        const categoryCounts = result.data.reduce((acc: Record<string, number>, row) => {
          acc[row.category] = (acc[row.category] || 0) + 1;
          return acc;
        }, {});
        
        return {
          data: Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
        };
      });
    
    console.log('\n📊 Продуктов по категориям:');
    stats?.forEach(row => {
      console.log(`   ${row.category}: ${row.count}`);
    });

    // Test search
    console.log('\n🔍 Тестируем поиск...');
    const { data: searchResults } = await supabase
      .from('products_nutrition')
      .select('name, calories')
      .ilike('name_normalized', '%курица%')
      .limit(3);
    
    if (searchResults && searchResults.length > 0) {
      console.log('   Поиск "курица":');
      searchResults.forEach(r => {
        console.log(`     • ${r.name} - ${r.calories} ккал`);
      });
    }

    console.log('\n✅ Все готово! База продуктов успешно загружена.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Импорт провален:', error);
    process.exit(1);
  }
}

// Run the import
importProducts();

