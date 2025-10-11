-- База продуктов для Supabase (PostgreSQL)

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL,
    category_id INTEGER NOT NULL,
    protein DECIMAL(6,2),
    fat DECIMAL(6,2),
    carbs DECIMAL(6,2),
    calories DECIMAL(6,2),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Индексы для поиска
CREATE INDEX idx_products_name_normalized ON products(name_normalized);
CREATE INDEX idx_products_category ON products(category_id);

-- Fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON products USING gin(name_normalized gin_trgm_ops);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('russian', name));

-- Категории

