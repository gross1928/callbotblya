# ✅ Чеклист для деплоя на Railway

## 📋 Обязательные переменные окружения

В Railway Dashboard → Settings → Variables добавьте:

### 1. Telegram Bot
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

**Как получить:**
1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен

### 2. OpenAI API
```
OPENAI_API_KEY=your_openai_api_key_here
```

**Как получить:**
1. Зайдите на [OpenAI Platform](https://platform.openai.com)
2. Перейдите в API Keys
3. Создайте новый ключ
4. Скопируйте ключ

### 3. Supabase
```
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Как получить:**
1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в Settings → API
3. Скопируйте URL и anon key

### 4. Системные переменные
```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## 🗄 Настройка базы данных

### 1. Создание проекта Supabase
1. Зайдите на [supabase.com](https://supabase.com)
2. Нажмите "New Project"
3. Выберите организацию
4. Введите название проекта
5. Создайте проект

### 2. Выполнение SQL схемы
1. Перейдите в SQL Editor
2. Скопируйте содержимое файла `database/schema.sql`
3. Вставьте и выполните SQL
4. Проверьте, что таблицы созданы

### 3. Настройка RLS
Таблицы уже настроены с Row Level Security для безопасности данных.

## 🚀 Деплой на Railway

### 1. Подключение репозитория
1. Зайдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Найдите репозиторий `gross1928/callbotblya`

### 2. Настройка переменных
1. Перейдите в Settings → Variables
2. Добавьте все переменные из списка выше
3. Сохраните изменения

### 3. Ожидание деплоя
1. Railway автоматически начнет сборку
2. Дождитесь завершения (обычно 2-5 минут)
3. Проверьте логи на наличие ошибок

## ✅ Проверка работоспособности

### 1. Health Check
Откройте URL вашего приложения: `https://your-app.railway.app/health`
Должен вернуть: `{"status": "ok", "timestamp": "..."}`

### 2. Тест бота
1. Найдите своего бота в Telegram
2. Отправьте `/start`
3. Пройдите регистрацию
4. Протестируйте основные функции

### 3. Проверка логов
1. В Railway Dashboard → Deployments
2. Выберите последний деплой
3. Просмотрите логи на ошибки

## 🐛 Решение проблем

### Ошибка "Bot token not found"
- Проверьте переменную `TELEGRAM_BOT_TOKEN`
- Убедитесь, что токен корректный

### Ошибка "OpenAI API error"
- Проверьте переменную `OPENAI_API_KEY`
- Убедитесь, что у вас есть доступ к API

### Ошибка "Supabase connection failed"
- Проверьте переменные `SUPABASE_URL` и `SUPABASE_ANON_KEY`
- Убедитесь, что проект создан и SQL схема выполнена

### Ошибка "Build failed"
- Проверьте логи сборки в Railway
- Убедитесь, что все зависимости в package.json

## 📊 Мониторинг

### Railway Dashboard
- CPU и Memory usage
- Network traffic
- Deployments history
- Logs в реальном времени

### Supabase Dashboard
- Database usage
- API requests
- Auth users
- Storage usage

### OpenAI Dashboard
- API usage
- Costs
- Rate limits

## 💰 Примерные расходы

### Railway
- Бесплатный план: до 500 часов в месяц
- Pro план: $5/месяц

### Supabase
- Бесплатный план: 500MB базы данных
- Pro план: $25/месяц

### OpenAI
- Pay-per-use
- Примерно $0.01-0.03 за запрос к Vision API
- Примерно $0.002 за запрос к GPT-4

## 🔄 Обновления

Railway автоматически деплоит при каждом пуше в main ветку GitHub.

Для обновления:
1. Внесите изменения в код
2. Запушьте в GitHub
3. Railway автоматически пересоберет и задеплоит

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в Railway Dashboard
2. Убедитесь в корректности всех переменных окружения
3. Проверьте статус внешних сервисов
4. Создайте issue в GitHub репозитории

---

**🎉 Поздравляем! Ваш бот "ДаЕда" готов к работе!**
