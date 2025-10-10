-- Migration 005: Add products nutrition database
-- This table stores nutritional information for food products

CREATE TABLE IF NOT EXISTS products_nutrition (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL, -- lowercase, trimmed for search
    category VARCHAR(100),
    protein DECIMAL(6,2) NOT NULL,
    fat DECIMAL(6,2) NOT NULL,
    carbs DECIMAL(6,2) NOT NULL,
    calories INTEGER NOT NULL,
    per_grams INTEGER DEFAULT 100, -- nutrition per X grams (usually 100)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast search
CREATE INDEX idx_products_name_normalized ON products_nutrition(name_normalized);
CREATE INDEX idx_products_category ON products_nutrition(category);

-- Add full-text search support for product names (PostgreSQL specific)
CREATE INDEX idx_products_name_search ON products_nutrition USING gin(to_tsvector('russian', name));

-- Add function to search products by similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products_nutrition USING gin(name_normalized gin_trgm_ops);

COMMENT ON TABLE products_nutrition IS 'Nutrition database for food products (per 100g)';
COMMENT ON COLUMN products_nutrition.name IS 'Product name in Russian';
COMMENT ON COLUMN products_nutrition.name_normalized IS 'Normalized name for fuzzy search';
COMMENT ON COLUMN products_nutrition.category IS 'Product category (хлеб, молочные, мясо, etc)';
COMMENT ON COLUMN products_nutrition.protein IS 'Protein in grams per 100g';
COMMENT ON COLUMN products_nutrition.fat IS 'Fat in grams per 100g';
COMMENT ON COLUMN products_nutrition.carbs IS 'Carbohydrates in grams per 100g';
COMMENT ON COLUMN products_nutrition.calories IS 'Calories (kcal) per 100g';

