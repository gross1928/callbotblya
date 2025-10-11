#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Простая трансформация baza.sql в PostgreSQL формат"""

with open('baza.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('products_supabase.sql', 'w', encoding='utf-8') as out:
    # Заголовок
    out.write("-- База продуктов для Supabase (PostgreSQL)\n\n")
    
    # CREATE TABLE для категорий
    out.write("CREATE TABLE IF NOT EXISTS categories (\n")
    out.write("    id SERIAL PRIMARY KEY,\n")
    out.write("    name VARCHAR(255) UNIQUE NOT NULL\n")
    out.write(");\n\n")
    
    # CREATE TABLE для продуктов с name_normalized
    out.write("CREATE TABLE IF NOT EXISTS products (\n")
    out.write("    id SERIAL PRIMARY KEY,\n")
    out.write("    name VARCHAR(255) NOT NULL,\n")
    out.write("    name_normalized VARCHAR(255) NOT NULL,\n")
    out.write("    category_id INTEGER NOT NULL,\n")
    out.write("    protein DECIMAL(6,2),\n")
    out.write("    fat DECIMAL(6,2),\n")
    out.write("    carbs DECIMAL(6,2),\n")
    out.write("    calories DECIMAL(6,2),\n")
    out.write("    FOREIGN KEY (category_id) REFERENCES categories(id)\n")
    out.write(");\n\n")
    
    # Индексы
    out.write("-- Индексы для поиска\n")
    out.write("CREATE INDEX idx_products_name_normalized ON products(name_normalized);\n")
    out.write("CREATE INDEX idx_products_category ON products(category_id);\n\n")
    
    # Fuzzy search
    out.write("-- Fuzzy search\n")
    out.write("CREATE EXTENSION IF NOT EXISTS pg_trgm;\n")
    out.write("CREATE INDEX idx_products_name_trgm ON products USING gin(name_normalized gin_trgm_ops);\n")
    out.write("CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('russian', name));\n\n")
    
    out.write("-- Категории\n")
    
    for line in lines:
        line = line.strip()
        
        # Пропускаем CREATE TABLE (мы уже написали свои)
        if line.startswith('CREATE TABLE'):
            continue
        if 'AUTOINCREMENT' in line or 'FOREIGN KEY' in line or line == ');':
            continue
            
        # INSERT для categories - оставляем как есть
        if line.startswith('INSERT INTO categories'):
            out.write(line + '\n')
        
        # INSERT для products - трансформируем
        elif line.startswith('INSERT INTO products'):
            # Заменяем название таблицы и колонок
            line = line.replace('INSERT INTO products (name, category_id, proteins, fats, carbohydrates, calories)',
                              'INSERT INTO products (name, name_normalized, category_id, protein, fat, carbs, calories)')
            
            # Извлекаем название продукта для name_normalized
            import re
            match = re.search(r"VALUES \('([^']+)',", line)
            if match:
                name = match.group(1)
                name_normalized = name.lower()
                # Экранируем кавычки
                name_normalized_escaped = name_normalized.replace("'", "''")
                # Вставляем name_normalized после name
                line = line.replace(f"VALUES ('{name}',", f"VALUES ('{name}', '{name_normalized_escaped}',")
            
            out.write(line + '\n')

print('✅ Файл products_supabase.sql создан!')


