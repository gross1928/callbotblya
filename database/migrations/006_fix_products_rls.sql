-- Migration 006: Fix RLS for products_nutrition table
-- This allows public read access to the products database
-- and allows inserts for import scripts

-- Disable RLS for products_nutrition (it's a public reference database)
ALTER TABLE products_nutrition DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled, use these policies instead:
/*
-- Enable RLS
ALTER TABLE products_nutrition ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read products
CREATE POLICY "Allow public read access to products"
  ON products_nutrition
  FOR SELECT
  USING (true);

-- Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access to products"
  ON products_nutrition
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
*/

COMMENT ON TABLE products_nutrition IS 'Public nutrition reference database - no RLS needed';

