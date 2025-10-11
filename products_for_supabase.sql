-- Миграция: Добавление продуктов в базу данных
-- Таблица products_nutrition для Supabase (PostgreSQL)

CREATE TABLE IF NOT EXISTS products_nutrition (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    protein DECIMAL(6,2) NOT NULL,
    fat DECIMAL(6,2) NOT NULL,
    carbs DECIMAL(6,2) NOT NULL,
    calories INTEGER NOT NULL,
    per_grams INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON products_nutrition(name_normalized);
CREATE INDEX IF NOT EXISTS idx_products_category ON products_nutrition(category);

-- Fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products_nutrition USING gin(name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products_nutrition USING gin(to_tsvector('russian', name));

-- Вставка продуктов
