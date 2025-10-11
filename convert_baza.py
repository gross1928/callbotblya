import re

# Маппинг категорий
categories = {
    1: 'Хлебобулочные',
    2: 'Молочные',
    3: 'Мясо и птица',
    4: 'Колбасные изделия',
    5: 'Рыба',
    6: 'Яйца',
    7: 'Масла и жиры',
    8: 'Овощи и зелень',
    9: 'Фрукты и ягоды',
    10: 'Орехи и семена',
    11: 'Сладкое',
    12: 'Напитки',
    13: 'Алкоголь'
}

# Читаем файл
with open('baza.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Извлекаем все INSERT'ы (числа могут быть с точкой или NULL)
pattern = r"INSERT INTO products \(name, category_id, proteins, fats, carbohydrates, calories\) VALUES \('([^']+)', (\d+), ([^,\)]+), ([^,\)]+), ([^,\)]+), ([^)]+)\);"
matches = re.findall(pattern, content)

print(f'Найдено {len(matches)} продуктов')

# Создаем новый SQL файл
with open('products_for_supabase.sql', 'w', encoding='utf-8') as f:
    # Заголовок
    f.write("-- Миграция: Добавление продуктов в базу данных\n")
    f.write("-- Таблица products_nutrition для Supabase (PostgreSQL)\n\n")
    
    # CREATE TABLE
    f.write("CREATE TABLE IF NOT EXISTS products_nutrition (\n")
    f.write("    id SERIAL PRIMARY KEY,\n")
    f.write("    name VARCHAR(255) NOT NULL,\n")
    f.write("    name_normalized VARCHAR(255) NOT NULL,\n")
    f.write("    category VARCHAR(100),\n")
    f.write("    protein DECIMAL(6,2) NOT NULL,\n")
    f.write("    fat DECIMAL(6,2) NOT NULL,\n")
    f.write("    carbs DECIMAL(6,2) NOT NULL,\n")
    f.write("    calories INTEGER NOT NULL,\n")
    f.write("    per_grams INTEGER DEFAULT 100,\n")
    f.write("    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n")
    f.write("    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n")
    f.write(");\n\n")
    
    # Индексы
    f.write("-- Индексы для быстрого поиска\n")
    f.write("CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON products_nutrition(name_normalized);\n")
    f.write("CREATE INDEX IF NOT EXISTS idx_products_category ON products_nutrition(category);\n\n")
    
    # pg_trgm для fuzzy search
    f.write("-- Fuzzy search\n")
    f.write("CREATE EXTENSION IF NOT EXISTS pg_trgm;\n")
    f.write("CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products_nutrition USING gin(name_normalized gin_trgm_ops);\n")
    f.write("CREATE INDEX IF NOT EXISTS idx_products_name_search ON products_nutrition USING gin(to_tsvector('russian', name));\n\n")
    
    f.write("-- Вставка продуктов\n")
    
    # INSERT'ы
    for name, cat_id, protein, fat, carbs, cal in matches:
        cat_id = int(cat_id)
        category = categories.get(cat_id, 'Разное')
        name_normalized = name.lower()
        
        # Экранируем одинарные кавычки
        name_escaped = name.replace("'", "''")
        name_normalized_escaped = name_normalized.replace("'", "''")
        
        # Обработка NULL значений и пробелов
        protein = protein.strip()
        fat = fat.strip()
        carbs = carbs.strip()
        cal = cal.strip()
        
        protein_val = 0.0 if protein == 'NULL' else float(protein)
        fat_val = 0.0 if fat == 'NULL' else float(fat)
        carbs_val = 0.0 if carbs == 'NULL' else float(carbs)
        cal_val = int(float(cal)) if cal != 'NULL' else 0
        
        f.write(f"INSERT INTO products_nutrition (name, name_normalized, category, protein, fat, carbs, calories) VALUES ")
        f.write(f"('{name_escaped}', '{name_normalized_escaped}', '{category}', {protein_val}, {fat_val}, {carbs_val}, {cal_val});\n")

print(f'✅ Создан файл products_for_supabase.sql с {len(matches)} продуктами!')

