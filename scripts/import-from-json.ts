/**
 * Import products from baza_productov.json into Supabase
 * Run with: npx ts-node scripts/import-from-json.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

interface ProductJSON {
  name: string;
  category?: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

async function importFromJSON() {
  try {
    console.log('🚀 Starting JSON import...');

    // Read JSON file
    const jsonPath = path.join(__dirname, '../baza_productov.json');
    console.log('📖 Reading JSON file...');
    
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const products: ProductJSON[] = JSON.parse(fileContent);

    console.log(`✅ Parsed ${products.length} products from JSON`);

    // Clear existing products
    console.log('\n🗑️  Clearing existing products...');
    const { error: deleteError } = await supabase
      .from('products_nutrition')
      .delete()
      .neq('id', 0); // Delete all

    if (deleteError) {
      console.error('Error clearing products:', deleteError);
    }

    // Insert products in batches (Supabase has limits)
    console.log('💾 Inserting products into Supabase...');
    
    const batchSize = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      // Transform products for database
      const dbProducts = batch.map(p => ({
        name: p.name,
        name_normalized: p.name.toLowerCase().trim(),
        category: p.category || 'Общие',
        protein: p.protein,
        fat: p.fat,
        carbs: p.carbs,
        calories: p.calories,
      }));

      const { data, error } = await supabase
        .from('products_nutrition')
        .insert(dbProducts)
        .select();

      if (error) {
        console.error(`  ❌ Batch ${i / batchSize + 1} failed:`, error.message);
        failed += batch.length;
      } else {
        inserted += data?.length || 0;
        console.log(`  ✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(products.length / batchSize)} (${inserted}/${products.length})`);
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Failed: ${failed}`);

    // Show stats
    const { data: stats, error: statsError } = await supabase
      .from('products_nutrition')
      .select('category');

    if (!statsError && stats) {
      console.log('\n📊 Products by category:');
      // Group by category manually
      const categoryCount: { [key: string]: number } = {};
      for (const row of stats as any[]) {
        const cat = row.category || 'Общие';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }
      
      Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`   ${category}: ${count}`);
        });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importFromJSON();

