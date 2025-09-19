# Настройка и запуск бота "ДаЕда"

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения

Скопируйте файл `env.example` в `.env` и заполните все необходимые переменные:

```bash
cp env.example .env
```

Заполните `.env` файл:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Environment
NODE_ENV=development
PORT=3000
```

### 3. Настройка базы данных Supabase

1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните SQL схему из файла `database/schema.sql`

### 4. Запуск бота

```bash
# Разработка (с автоперезагрузкой)
npm run dev

# Продакшн
npm run build
npm start
```

## 🔧 Получение API ключей

### Telegram Bot Token

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен в `.env`

### OpenAI API Key

1. Зарегистрируйтесь на [OpenAI](https://platform.openai.com)
2. Перейдите в API Keys
3. Создайте новый ключ
4. Скопируйте ключ в `.env`

### Supabase Credentials

1. Создайте проект в [Supabase](https://supabase.com)
2. Перейдите в Settings → API
3. Скопируйте URL и anon key в `.env`

## 📊 Структура базы данных

После выполнения SQL схемы будут созданы таблицы:

- `user_profiles` - профили пользователей
- `food_entries` - записи о еде
- `water_entries` - записи о воде  
- `medical_data` - медицинские данные
- `chat_messages` - сообщения AI-коуча

## 🛠 Команды разработки

```bash
# Проверка типов TypeScript
npm run type-check

# Сборка проекта
npm run build

# Разработка с автоперезагрузкой
npm run dev

# Запуск продакшн версии
npm start
```

## 🚀 Деплой

### Vercel (рекомендуется)

1. Установите Vercel CLI: `npm i -g vercel`
2. Запустите: `vercel`
3. Настройте переменные окружения в Vercel dashboard
4. Установите webhook URL в BotFather

### Railway

1. Подключите GitHub репозиторий к Railway
2. Настройте переменные окружения
3. Railway автоматически задеплоит проект

### Собственный сервер

1. Соберите проект: `npm run build`
2. Запустите: `npm start`
3. Настройте reverse proxy (nginx)
4. Установите webhook URL в BotFather

## 📝 Проверка работы

После запуска бота:

1. Найдите своего бота в Telegram
2. Отправьте `/start`
3. Пройдите регистрацию профиля
4. Протестируйте основные функции:
   - Добавление еды (фото/текст)
   - Трекинг воды
   - Дашборд
   - AI-коуч

## 🐛 Решение проблем

### Ошибки подключения к базе данных
- Проверьте URL и ключ Supabase
- Убедитесь, что SQL схема выполнена

### Ошибки OpenAI API
- Проверьте API ключ
- Убедитесь, что у вас есть доступ к GPT-4

### Ошибки Telegram API
- Проверьте токен бота
- Убедитесь, что бот не заблокирован

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи в консоли
2. Убедитесь, что все переменные окружения настроены
3. Проверьте подключение к интернету
4. Создайте issue в репозитории
