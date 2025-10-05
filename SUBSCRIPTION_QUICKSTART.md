# 🚀 Быстрый Старт: Система Подписки

## ✅ Что нужно сделать для запуска

### 1️⃣ Применить миграцию БД (5 минут)

1. Зайдите в **Supabase Dashboard** → SQL Editor
2. Скопируйте содержимое `database/migrations/004_add_subscription_fields.sql`
3. Вставьте и нажмите **Run**
4. Проверьте успешность:
   ```sql
   SELECT * FROM user_profiles LIMIT 1;
   -- Должны появиться поля: subscription_status, trial_end_date, subscription_end_date
   ```

### 2️⃣ Задеплоить код (2 минуты)

```bash
# Соберите проект
npm run build

# Закоммитьте изменения
git add .
git commit -m "feat: add subscription system"
git push origin main
```

Railway автоматически задеплоит за ~3 минуты.

### 3️⃣ Проверить работу (2 минуты)

1. Откройте бота в Telegram
2. Отправьте `/start` или `/subscription`
3. Проверьте, что команда `/subscription` есть в меню
4. Проверьте кнопку "💳 Подписка" в главном меню

---

## 🎯 Что получилось

### ✅ Автоматический триал
- Новые пользователи получают 3 дня бесплатно
- Полный доступ ко всем функциям
- Уведомление о триале после регистрации

### ✅ Блокировка после истечения
- Все функции блокируются
- Показывается сообщение с предложением подписки
- Пользователь может оформить подписку

### ✅ Страница подписки
- Команда `/subscription`
- Кнопка "💳 Подписка" в меню
- Показывает статус и список функций
- Цена: 199₽/месяц

### ✅ Автоматические уведомления
- За 24 часа до истечения
- При истечении подписки/триала
- Проверка каждые 12 часов

---

## 🔧 Что делать дальше

### Добавить платежную систему
Сейчас при нажатии "Оформить подписку" показывается placeholder.

**Нужно добавить:**
1. Реальную ссылку на оплату
2. Webhook для активации после оплаты

**Варианты:**
- ЮKassa (YooMoney) - рекомендуется для РФ
- Robokassa
- Telegram Payments (встроенные платежи)
- Stripe (для международных)

### Пример интеграции с ЮKassa:

1. В `src/handlers/subscription.ts` замените placeholder:
   ```typescript
   const paymentUrl = `https://yookassa.ru/checkout?...`;
   await ctx.reply(`Ссылка на оплату: ${paymentUrl}`);
   ```

2. Создайте webhook endpoint:
   ```typescript
   // src/webhooks/payment.ts
   app.post('/webhook/payment', async (req, res) => {
     const { telegram_id, status } = req.body;
     
     if (status === 'succeeded') {
       await activateSubscription(telegram_id, 30); // 30 дней
       await bot.telegram.sendMessage(telegram_id, '✅ Подписка активирована!');
     }
     
     res.sendStatus(200);
   });
   ```

---

## 📊 Мониторинг

### Проверить статистику подписок:
```sql
-- В Supabase SQL Editor
SELECT 
  subscription_status,
  COUNT(*) as users
FROM user_profiles
GROUP BY subscription_status;
```

### Проверить логи:
В Railway Dashboard → Logs → искать `[Subscription Checker]`

---

## 🧪 Тестирование

### Тест нового пользователя:
1. Создайте новый аккаунт Telegram или используйте другого пользователя
2. Отправьте боту `/start`
3. Пройдите регистрацию
4. Должно появиться: "🎁 Вам открыт демо-доступ на 3 дня!"

### Тест истечения триала:
```sql
-- В Supabase SQL Editor
UPDATE user_profiles 
SET trial_end_date = NOW() - INTERVAL '1 day'
WHERE telegram_id = YOUR_TELEGRAM_ID;
```
Попробуйте использовать функции бота - должна быть блокировка.

### Тест страницы подписки:
1. Отправьте `/subscription`
2. Проверьте корректность отображения статуса
3. Проверьте кнопку "Оформить подписку"

---

## ⚡ Полезные SQL запросы

### Выдать подписку вручную:
```sql
UPDATE user_profiles 
SET subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '30 days'
WHERE telegram_id = USER_TELEGRAM_ID;
```

### Вернуть триал (для тестирования):
```sql
UPDATE user_profiles 
SET subscription_status = 'trial',
    trial_end_date = NOW() + INTERVAL '3 days',
    subscription_end_date = NULL
WHERE telegram_id = YOUR_TELEGRAM_ID;
```

### Список истекающих триалов:
```sql
SELECT 
  telegram_id,
  name,
  trial_end_date,
  EXTRACT(DAY FROM (trial_end_date - NOW())) as days_left
FROM user_profiles
WHERE subscription_status = 'trial'
ORDER BY trial_end_date;
```

---

## 📝 Чеклист запуска

- [ ] Применена миграция БД
- [ ] Код задеплоен на Railway
- [ ] Проверена команда `/subscription`
- [ ] Проверена кнопка "💳 Подписка"
- [ ] Протестирован триал нового пользователя
- [ ] Протестирована блокировка функций
- [ ] Проверены логи Subscription Checker
- [ ] (Опционально) Миграция существующих пользователей

---

## 🆘 Возможные проблемы

### "Column already exists"
Миграция уже применена. Пропустите шаг 1.

### Команда `/subscription` не появилась
Перезапустите бота:
```bash
# В Railway Dashboard
Deployments → Latest → Restart
```

### Уведомления не отправляются
Проверьте логи на наличие:
```
[Subscription Checker] Starting periodic checker...
```

---

## 🎉 Готово!

Система подписки работает! 

**Следующий шаг:** Добавьте реальную платежную систему для приема оплаты.

---

**Вопросы?** Telegram: @grossvn
