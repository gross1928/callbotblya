# Применение миграции 006: Исправление RLS для products_nutrition

## Проблема
При импорте продуктов возникает ошибка:
```
new row violates row-level security policy for table "products_nutrition"
```

## Решение
Нужно отключить Row-Level Security (RLS) для таблицы `products_nutrition`, так как это публичная справочная база данных продуктов.

## Шаги применения

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Зайдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**
4. Скопируйте и вставьте следующий SQL:

```sql
-- Отключаем RLS для products_nutrition (это публичная справочная база)
ALTER TABLE products_nutrition DISABLE ROW LEVEL SECURITY;

-- Добавляем комментарий
COMMENT ON TABLE products_nutrition IS 'Public nutrition reference database - no RLS needed';
```

5. Нажмите **Run** или **F5**

### Вариант 2: Через psql (если есть доступ)

```bash
psql "$DIRECT_DATABASE_URL" -f database/migrations/006_fix_products_rls.sql
```

## После применения миграции

Запустите импорт продуктов заново:

```bash
npx ts-node scripts/import-products-supabase.ts
```

## Проверка

Проверьте, что RLS отключен:

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'products_nutrition';
```

Результат должен быть `rowsecurity = false`.

## Безопасность

**Почему это безопасно?**
- Таблица `products_nutrition` - это справочная база данных продуктов (как словарь)
- Она содержит только публичные данные о калорийности продуктов
- Пользователи могут только читать эти данные через приложение
- Только администраторы могут запускать скрипты импорта
- Нет персональных данных пользователей в этой таблице

