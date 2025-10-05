# Применение миграции 004: Подписка

## 📋 Описание

Эта миграция добавляет функциональность подписки в бота:
- 3-дневный триал для новых пользователей
- Платная подписка (199₽/месяц)
- Автоматическая проверка истечения подписок
- Уведомления пользователям

## 🗄️ Изменения в БД

Добавляет 3 новых поля в таблицу `user_profiles`:
- `subscription_status` - статус подписки ('trial', 'active', 'expired')
- `trial_end_date` - дата окончания триала
- `subscription_end_date` - дата окончания подписки

## 🚀 Применение миграции

### 1. Зайдите в Supabase Dashboard
1. Откройте ваш проект на [supabase.com](https://supabase.com)
2. Перейдите в раздел **SQL Editor**

### 2. Выполните SQL миграцию
1. Скопируйте содержимое файла `004_add_subscription_fields.sql`
2. Вставьте в SQL Editor
3. Нажмите **Run** или **Ctrl+Enter**

### 3. Проверьте успешность миграции
Выполните следующий запрос для проверки:

```sql
-- Проверить структуру таблицы
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('subscription_status', 'trial_end_date', 'subscription_end_date');

-- Должны увидеть 3 строки с новыми полями
```

### 4. (Опционально) Миграция существующих пользователей

Если у вас уже есть пользователи и вы хотите дать им триал на 3 дня:

```sql
-- Дать всем существующим пользователям триал на 3 дня
UPDATE user_profiles 
SET subscription_status = 'trial',
    trial_end_date = NOW() + INTERVAL '3 days'
WHERE subscription_status IS NULL;
```

Или если хотите дать им активную подписку на 30 дней:

```sql
-- Дать всем существующим пользователям активную подписку на 30 дней
UPDATE user_profiles 
SET subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '30 days'
WHERE subscription_status IS NULL;
```

## ✅ Деплой кода

После применения миграции БД:

1. **Пересоберите проект:**
   ```bash
   npm run build
   ```

2. **Запустите локально для теста:**
   ```bash
   npm run dev
   ```

3. **Задеплойте на Railway:**
   - Закоммитьте изменения в Git
   - Запуште в main ветку
   - Railway автоматически задеплоит

## 🧪 Тестирование

### Тест 1: Регистрация нового пользователя
1. Отправьте боту `/start`
2. Пройдите регистрацию
3. Должно появиться сообщение о 3-дневном триале

### Тест 2: Страница подписки
1. Отправьте `/subscription`
2. Должна открыться страница с информацией о подписке
3. Проверьте, что отображается корректный статус

### Тест 3: Блокировка функций
1. Вручную установите `subscription_status = 'expired'` в БД для тестового пользователя
2. Попробуйте использовать функции бота (добавить еду, воду и т.д.)
3. Должно появиться сообщение о необходимости подписки

### Тест 4: Проверка истечения
Вручную запустите проверку подписок:
```sql
-- Установить триал, который истек 1 день назад
UPDATE user_profiles 
SET trial_end_date = NOW() - INTERVAL '1 day'
WHERE telegram_id = YOUR_TELEGRAM_ID;
```
Затем перезапустите бота - через 12 часов должно прийти уведомление.

## 📊 Мониторинг

### Проверка статистики подписок
```sql
-- Количество пользователей по статусам
SELECT 
  subscription_status,
  COUNT(*) as count
FROM user_profiles
GROUP BY subscription_status;

-- Пользователи на триале
SELECT 
  telegram_id,
  name,
  trial_end_date,
  EXTRACT(DAY FROM (trial_end_date - NOW())) as days_remaining
FROM user_profiles
WHERE subscription_status = 'trial'
ORDER BY trial_end_date;

-- Истекающие подписки (в ближайшие 7 дней)
SELECT 
  telegram_id,
  name,
  subscription_end_date,
  EXTRACT(DAY FROM (subscription_end_date - NOW())) as days_remaining
FROM user_profiles
WHERE subscription_status = 'active'
  AND subscription_end_date < NOW() + INTERVAL '7 days'
ORDER BY subscription_end_date;
```

## 🔧 Ручное управление подписками

### Выдать подписку пользователю
```sql
-- Выдать активную подписку на 30 дней
UPDATE user_profiles 
SET subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '30 days'
WHERE telegram_id = USER_TELEGRAM_ID;
```

### Продлить подписку
```sql
-- Продлить подписку на 30 дней от текущей даты истечения
UPDATE user_profiles 
SET subscription_end_date = subscription_end_date + INTERVAL '30 days'
WHERE telegram_id = USER_TELEGRAM_ID;
```

### Вернуть триал (для тестирования)
```sql
-- Сбросить на триал на 3 дня
UPDATE user_profiles 
SET subscription_status = 'trial',
    trial_end_date = NOW() + INTERVAL '3 days',
    subscription_end_date = NULL
WHERE telegram_id = USER_TELEGRAM_ID;
```

## 🎯 Следующие шаги

1. ✅ Применить миграцию БД
2. ✅ Задеплоить код
3. ✅ Протестировать функционал
4. 🔜 Интегрировать платежную систему (ссылка на оплату)
5. 🔜 Настроить webhook для автоматической активации подписки после оплаты

## 🆘 Возможные проблемы

### Ошибка: "column already exists"
Миграция уже была применена. Проверьте наличие полей:
```sql
SELECT * FROM user_profiles LIMIT 1;
```

### Бот не отправляет уведомления
1. Проверьте логи: `Subscription Checker`
2. Убедитесь, что checker запущен при старте бота
3. Проверьте права бота на отправку сообщений

### Пользователи не видят страницу подписки
1. Убедитесь, что команда `/subscription` добавлена в меню бота
2. Перезапустите бота
3. Проверьте, что новые команды установлены в логах

---

**Готово!** Функционал подписки успешно добавлен в бота! 🎉
