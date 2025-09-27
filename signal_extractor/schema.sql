-- БЛОК 2: SIGNAL EXTRACTOR - Database Schema

-- Таблица торговых сигналов
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    news_id VARCHAR(100) NOT NULL REFERENCES news(id),
    ticker VARCHAR(10) NOT NULL,
    action VARCHAR(5) NOT NULL CHECK (action IN ('BUY', 'SHORT')),
    wave INTEGER NOT NULL CHECK (wave >= 0),

    -- Временное окно для входа
    entry_start TIMESTAMP NOT NULL,
    entry_optimal TIMESTAMP NOT NULL,
    entry_end TIMESTAMP NOT NULL,

    -- Ожидания
    expected_move_percent REAL NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

    -- Риск-менеджмент (из конфигурации)
    stop_loss_percent REAL NOT NULL,
    take_profit_percent REAL NOT NULL,
    max_hold_hours INTEGER NOT NULL,

    -- Флаги и метаданные
    is_optimal_wave BOOLEAN NOT NULL DEFAULT FALSE,
    reasoning TEXT NOT NULL,

    -- Валидация
    ticker_validated BOOLEAN NOT NULL DEFAULT FALSE,
    ticker_exists BOOLEAN,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Обновляем таблицу news для отслеживания обработки
ALTER TABLE news ADD COLUMN IF NOT EXISTS processed_by_block2 BOOLEAN DEFAULT FALSE;
ALTER TABLE news ADD COLUMN IF NOT EXISTS block2_processed_at TIMESTAMP;
ALTER TABLE news ADD COLUMN IF NOT EXISTS block2_skip_reason TEXT;

-- Индексы для быстрого поиска
CREATE INDEX idx_signals_news_id ON signals(news_id);
CREATE INDEX idx_signals_ticker ON signals(ticker);
CREATE INDEX idx_signals_wave ON signals(wave);
CREATE INDEX idx_signals_action ON signals(action);
CREATE INDEX idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX idx_signals_optimal_wave ON signals(is_optimal_wave) WHERE is_optimal_wave = TRUE;
CREATE INDEX idx_signals_entry_time ON signals(entry_start, entry_end);

-- Индекс для необработанных новостей
CREATE INDEX idx_news_unprocessed_block2 ON news(processed_by_block2) WHERE processed_by_block2 = FALSE;

-- Функция для отправки уведомлений (будет использоваться в БЛОК 1)
CREATE OR REPLACE FUNCTION notify_new_significant_news() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_significant = TRUE THEN
        PERFORM pg_notify('new_significant_news', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматических уведомлений от БЛОК 1
CREATE TRIGGER trigger_notify_significant_news
    AFTER INSERT ON news
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_significant_news();

-- Функция для уведомлений о новых сигналах
CREATE OR REPLACE FUNCTION notify_new_trading_signals() RETURNS TRIGGER AS $$
DECLARE
    signal_count INTEGER;
BEGIN
    -- Считаем количество сигналов для этой новости
    SELECT COUNT(*) INTO signal_count
    FROM signals
    WHERE news_id = NEW.news_id;

    -- Отправляем уведомление с количеством сигналов
    PERFORM pg_notify('new_trading_signals', signal_count::text);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для уведомлений о новых сигналах
CREATE TRIGGER trigger_notify_trading_signals
    AFTER INSERT ON signals
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_trading_signals();