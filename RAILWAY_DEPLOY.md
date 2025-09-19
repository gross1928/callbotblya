# 🚀 Деплой на Railway

## 📋 Переменные окружения (Environment Variables)

В Railway Dashboard нужно настроить следующие переменные:

### Обязательные переменные:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
NODE_ENV=production
PORT=3000
```

### Опциональные переменные:
```
LOG_LEVEL=info
TELEGRAM_WEBHOOK_URL=https://your-app-name.railway.app
```

## 🛠 Пошаговая инструкция деплоя

### 1. Подготовка Railway
1. Зайдите на [Railway](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Выберите репозиторий `gross1928/callbotblya`
6. Railway автоматически обнаружит Dockerfile и начнет сборку

### 2. Настройка переменных окружения
1. В Railway Dashboard перейдите в Settings → Variables
2. Добавьте все переменные из списка выше
3. Убедитесь, что все значения корректны

### 3. Настройка базы данных
1. Создайте проект в [Supabase](https://supabase.com)
2. Выполните SQL схему из `database/schema.sql`
3. Скопируйте URL и anon key в Railway переменные

### 4. Настройка Telegram Webhook
После деплоя:
1. Скопируйте URL вашего Railway приложения
2. Добавьте к нему `/webhook` (если нужно)
3. Установите webhook через BotFather или API

### 5. Проверка деплоя
1. Railway автоматически соберет и запустит приложение
2. Проверьте логи на наличие ошибок
3. Откройте URL приложения - должно показать статус
4. Протестируйте бота в Telegram

## 🔧 Получение API ключей

### Telegram Bot Token
1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен в Railway

### OpenAI API Key
1. Зарегистрируйтесь на [OpenAI Platform](https://platform.openai.com)
2. Перейдите в API Keys
3. Создайте новый ключ
4. Скопируйте ключ в Railway

### Supabase Credentials
1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в Settings → API
3. Скопируйте URL и anon key в Railway

## 📊 Мониторинг

### Логи Railway
- Перейдите в Railway Dashboard → Deployments
- Выберите ваш деплой
- Просматривайте логи в реальном времени

### Health Check
- URL: `https://your-app.railway.app/health`
- Должен возвращать: `{"status": "ok", "timestamp": "..."}`

### Метрики
- Railway показывает CPU, Memory, Network usage
- Следите за производительностью
- Настройте алерты при превышении лимитов

## 🚨 Решение проблем

### Ошибки сборки
- Проверьте логи сборки в Railway
- Убедитесь, что все зависимости в package.json
- Проверьте TypeScript компиляцию

### Ошибки запуска
- Проверьте переменные окружения
- Убедитесь, что все API ключи корректны
- Проверьте подключение к Supabase

### Ошибки бота
- Проверьте Telegram Bot Token
- Убедитесь, что webhook настроен правильно
- Проверьте логи бота в Railway

### Ошибки Docker сборки
- Проверьте Dockerfile на синтаксические ошибки
- Убедитесь, что все зависимости указаны в package.json
- Проверьте, что TypeScript компилируется без ошибок
- При необходимости очистите кэш Railway

## 💰 Стоимость

### Railway
- Бесплатный план: $0/месяц (ограниченные ресурсы)
- Pro план: $5/месяц (больше ресурсов)
- Pay-as-you-go: плата за использование

### Supabase
- Бесплатный план: до 500MB базы данных
- Pro план: $25/месяц

### OpenAI
- Pay-per-use модель
- Зависит от количества запросов
- Примерно $0.01-0.03 за запрос

## 🔄 Обновления

### Автоматические обновления
Railway автоматически деплоит при пуше в main ветку GitHub.

### Ручные обновления
1. Внесите изменения в код
2. Запушьте в GitHub
3. Railway автоматически пересоберет и задеплоит

### Откат
1. В Railway Dashboard → Deployments
2. Выберите предыдущую версию
3. Нажмите "Deploy"

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в Railway Dashboard
2. Убедитесь в корректности переменных окружения
3. Проверьте статус сервисов (Telegram, OpenAI, Supabase)
4. Создайте issue в GitHub репозитории
