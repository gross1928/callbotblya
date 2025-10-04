-- Таблица для пользовательских продуктов
CREATE TABLE IF NOT EXISTS user_products (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  calories INTEGER NOT NULL,
  protein DECIMAL(10, 1) NOT NULL,
  fat DECIMAL(10, 1) NOT NULL,
  carbs DECIMAL(10, 1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Индекс для быстрого поиска продуктов пользователя
  CONSTRAINT fk_user_products_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES user_profiles(telegram_id) 
    ON DELETE CASCADE
);

-- Индекс для ускорения запросов
CREATE INDEX idx_user_products_user_id ON user_products(user_id);
CREATE INDEX idx_user_products_created_at ON user_products(created_at DESC);

-- Комментарии
COMMENT ON TABLE user_products IS 'Пользовательские продукты для быстрого добавления';
COMMENT ON COLUMN user_products.user_id IS 'ID пользователя в Telegram';
COMMENT ON COLUMN user_products.name IS 'Название продукта';
COMMENT ON COLUMN user_products.calories IS 'Калории на 100г';
COMMENT ON COLUMN user_products.protein IS 'Белки на 100г';
COMMENT ON COLUMN user_products.fat IS 'Жиры на 100г';
COMMENT ON COLUMN user_products.carbs IS 'Углеводы на 100г';

