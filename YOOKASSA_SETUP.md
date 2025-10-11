# 💳 Настройка автоматических платежей через ЮKassa

Это руководство поможет настроить автоматическую активацию подписок после оплаты через ЮKassa.

---

## 📋 Что было добавлено

### ✅ **Файлы:**
- `src/handlers/payment.ts` - обработка webhook от ЮKassa
- `src/utils/yookassa.ts` - создание платежей через API
- `src/index.ts` - endpoint `/webhook/yookassa`
- Обновлены: `src/handlers/subscription.ts`, `src/config/index.ts`, `env.example`

### ✅ **Функционал:**
1. Webhook endpoint для приема уведомлений от ЮKassa
2. Автоматическая активация подписки на 30 дней после оплаты
3. Уведомление пользователю в Telegram об активации
4. Создание уникального платежа для каждого пользователя через API
5. Fallback на многоразовую ссылку если API не настроен

---

## 🚀 Как это работает

### **Режим 1: С ЮKassa API (автоматика)**
```
Пользователь → Кнопка "Оплатить"
           ↓
ЮKassa API → Создание платежа с telegram_id в metadata
           ↓
Уникальная ссылка → Оплата
           ↓
ЮKassa → Webhook уведомление → Ваш бот
           ↓
Автоактивация подписки на 30 дней ✅
           ↓
Уведомление пользователю в Telegram ✅
```

### **Режим 2: Без API (ручная активация)**
```
Пользователь → Многоразовая ссылка → Оплата с telegram_id в комментарии
           ↓
Напишет тебе @grossvn
           ↓
Ты активируешь вручную в Supabase
```

---

## ⚙️ Настройка (3 шага)

### **Шаг 1: Получить API ключи от ЮKassa**

1. Зайди на https://yookassa.ru/
2. Перейди в **Настройки** → **Интеграция** → **HTTP-уведомления**
3. Скопируй:
   - **shopId** (ID магазина)
   - **Секретный ключ**

### **Шаг 2: Настроить webhook в ЮKassa**

1. В том же разделе **HTTP-уведомления**
2. Включи уведомления о платежах
3. URL webhook: `https://your-app-name.railway.app/webhook/yookassa`
   - Замени `your-app-name` на имя твоего Railway app
4. Выбери события:
   - ✅ `payment.succeeded` (успешный платёж)
   - ✅ `payment.canceled` (отменен)
5. Сохрани

### **Шаг 3: Добавить переменные в Railway**

1. Открой Railway Dashboard → Твой проект → Variables
2. Добавь переменные:
   ```
   YOOKASSA_SHOP_ID=123456
   YOOKASSA_SECRET_KEY=live_abc123xyz
   YOOKASSA_FALLBACK_URL=https://yookassa.ru/my/i/aOpIUMo8mx8q/l
   ```
3. Сохрани и Railway автоматически перезапустит бот

---

## 🧪 Тестирование

### **1. Протестировать webhook endpoint**

```bash
# Railway даст URL типа: https://daeeda-food-bot-production.up.railway.app
# Webhook будет: https://daeeda-food-bot-production.up.railway.app/webhook/yookassa

# Проверь что endpoint работает:
curl https://your-app-name.railway.app/webhook/yookassa \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "test123",
      "status": "succeeded",
      "amount": {
        "value": "199.00",
        "currency": "RUB"
      },
      "metadata": {
        "telegram_id": "6103273611"
      }
    }
  }'

# Должен вернуть: OK
```

### **2. Протестировать в боте**

1. Запусти бота → `/subscription`
2. Нажми "💳 Оформить подписку"
3. Если API настроен:
   - Увидишь: "После оплаты подписка активируется **автоматически**"
   - Кнопка ведет на уникальную ссылку
4. Если API НЕ настроен:
   - Увидишь: "Укажите ваш ID в комментарии"
   - Кнопка ведет на fallback ссылку

### **3. Тестовая оплата**

ЮKassa предоставляет тестовую среду:
1. Зайди в https://yookassa.ru/developers/payment-acceptance/testing-and-going-live
2. Используй тестовую карту: `5555 5555 5555 4444`
3. CVC: любой 3-значный
4. Дата: любая будущая
5. 3DS: `12345` (тестовый код)

---

## 📊 Мониторинг

### **Логи webhook в Railway**

```bash
# В Railway Dashboard → Deployments → Logs
# Поищи строки:
[ЮKassa Webhook] Received notification: {...}
[Payment Handler] Processing payment for user 6103273611
[Payment Handler] Subscription activated for user 6103273611 until 2025-11-10...
[Payment Handler] Activation notification sent to 6103273611
[Payment Handler] Payment processed successfully
```

### **Проверка в Supabase**

```sql
-- Посмотреть активированные подписки
SELECT 
  telegram_id,
  subscription_status,
  subscription_end_date,
  updated_at
FROM user_profiles
WHERE subscription_status = 'active'
ORDER BY updated_at DESC
LIMIT 10;
```

---

## 🐛 Решение проблем

### **Webhook не работает**

**Симптом:** Оплата проходит, но подписка не активируется.

**Решения:**
1. Проверь URL webhook в ЮKassa dashboard - должен быть правильный
2. Проверь логи Railway - видны ли уведомления от ЮKassa
3. Проверь что `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` правильно заданы
4. Проверь что в платеже есть `metadata.telegram_id`

### **API не создает платёж**

**Симптом:** Бот использует fallback ссылку вместо API.

**Решения:**
1. Проверь логи: `[Subscription] ЮKassa API not configured`
2. Убедись что `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` заданы в Railway
3. Проверь что ключи правильные (скопируй заново из ЮKassa)

### **Пользователь оплатил, но подписка не активирована**

**Ручная активация:**
```sql
-- В Supabase SQL Editor:
UPDATE user_profiles
SET 
  subscription_status = 'active',
  subscription_end_date = NOW() + INTERVAL '30 days'
WHERE telegram_id = 6103273611; -- ID пользователя

-- Затем отправь пользователю сообщение вручную
```

---

## 🎯 Текущий статус

### **Без API настройки (сейчас):**
```
✅ Webhook endpoint работает
✅ Обработка платежей готова
⚠️ Используется fallback ссылка
⚠️ Требуется ручное указание telegram_id
```

### **С API настройкой (после Шага 1-3):**
```
✅ Webhook endpoint работает
✅ Обработка платежей готова
✅ Создание уникальных ссылок через API
✅ Автоматическая передача telegram_id
✅ 100% автоматика
```

---

## 💡 Дополнительные возможности

### **Уведомления о неудачных платежах**

Можешь добавить обработку `payment.canceled`:

```typescript
// В src/handlers/payment.ts
if (notification.event === 'payment.canceled') {
  await bot.telegram.sendMessage(telegramId, 
    '⚠️ Оплата была отменена. Попробуй ещё раз командой /subscription'
  );
}
```

### **Рефанды (возвраты)**

Можешь обработать `refund.succeeded`:

```typescript
if (notification.event === 'refund.succeeded') {
  // Деактивировать подписку
  await db.from('user_profiles')
    .update({ subscription_status: 'expired' })
    .eq('telegram_id', telegramId);
}
```

### **Логирование платежей**

Можешь создать таблицу `payments` для истории:

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT NOT NULL,
  payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📞 Поддержка

**Если что-то не работает:**
1. Проверь логи в Railway Dashboard
2. Проверь настройки в ЮKassa dashboard
3. Напиши @grossvn

**Документация ЮKassa:**
- [API документация](https://yookassa.ru/developers/api)
- [Webhook уведомления](https://yookassa.ru/developers/using-api/webhooks)
- [Тестирование](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live)

---

## ✅ Готово!

Теперь при оплате:
1. Пользователь нажимает "Оплатить" → уникальная ссылка
2. Оплачивает 199₽
3. ЮKassa отправляет webhook на твой сервер
4. Бот автоматически активирует подписку на 30 дней
5. Пользователь получает уведомление ✅

**Автоматика работает! 🎉**

