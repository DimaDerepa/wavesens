-- БЛОК 3: EXPERIMENT MANAGER - База данных
-- Виртуальная торговая площадка для тестирования стратегии

-- Таблица экспериментов (виртуальных сделок)
CREATE TABLE IF NOT EXISTS experiments (
    id SERIAL PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES signals(id),
    news_id VARCHAR(100) NOT NULL REFERENCES news(id),

    -- Entry данные
    entry_time TIMESTAMP NOT NULL DEFAULT NOW(),
    entry_price REAL NOT NULL,
    position_size REAL NOT NULL,
    shares REAL NOT NULL,
    commission_paid REAL NOT NULL DEFAULT 0,

    -- Exit данные
    exit_time TIMESTAMP,
    exit_price REAL,
    exit_reason VARCHAR(50), -- stop_loss/take_profit/time/manual/daily_limit

    -- Results
    gross_pnl REAL,
    net_pnl REAL,
    return_percent REAL,
    hold_duration INTEGER, -- minutes

    -- Benchmark data
    sp500_entry REAL NOT NULL,
    sp500_exit REAL,
    sp500_return REAL,
    alpha REAL, -- our return - sp500 return

    -- Position management
    stop_loss_price REAL NOT NULL,
    take_profit_price REAL NOT NULL,
    max_hold_until TIMESTAMP NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'failed')),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Снимки портфеля каждые 5 минут
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Portfolio состояние
    total_value REAL NOT NULL,
    cash_balance REAL NOT NULL,
    positions_count INTEGER NOT NULL DEFAULT 0,

    -- P&L
    unrealized_pnl REAL NOT NULL DEFAULT 0,
    realized_pnl_today REAL NOT NULL DEFAULT 0,
    realized_pnl_total REAL NOT NULL DEFAULT 0,

    -- Performance
    daily_return REAL NOT NULL DEFAULT 0,
    total_return REAL NOT NULL DEFAULT 0,

    -- Benchmark
    sp500_price REAL,
    sp500_daily_return REAL,
    alpha_daily REAL,

    -- Risk metrics
    max_drawdown REAL,
    current_drawdown REAL,
    positions_exposure REAL,

    UNIQUE(timestamp)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_signal_id ON experiments(signal_id);
CREATE INDEX IF NOT EXISTS idx_experiments_entry_time ON experiments(entry_time);
CREATE INDEX IF NOT EXISTS idx_experiments_exit_time ON experiments(exit_time);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);

-- Функция для уведомлений о новых сигналах
CREATE OR REPLACE FUNCTION notify_new_trading_signals()
RETURNS TRIGGER AS $$
BEGIN
    -- Уведомляем БЛОК 3 о новых сигналах
    PERFORM pg_notify('new_trading_signals', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на новые сигналы
DROP TRIGGER IF EXISTS signal_insert_notify ON signals;
CREATE TRIGGER signal_insert_notify
    AFTER INSERT ON signals
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_trading_signals();

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для experiments
DROP TRIGGER IF EXISTS experiments_updated_at ON experiments;
CREATE TRIGGER experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Представление для активных позиций
CREATE OR REPLACE VIEW active_positions AS
SELECT
    e.*,
    s.ticker,
    s.action,
    s.wave,
    s.confidence,
    n.headline
FROM experiments e
JOIN signals s ON e.signal_id = s.id
JOIN news n ON e.news_id = n.id
WHERE e.status = 'active'
ORDER BY e.entry_time DESC;

-- Представление для дневной статистики
CREATE OR REPLACE VIEW daily_stats AS
SELECT
    date(exit_time) as trade_date,
    COUNT(*) as trades_count,
    COUNT(*) FILTER (WHERE net_pnl > 0) as winning_trades,
    COUNT(*) FILTER (WHERE net_pnl <= 0) as losing_trades,
    ROUND(COUNT(*) FILTER (WHERE net_pnl > 0)::NUMERIC / COUNT(*) * 100, 2) as win_rate,
    ROUND(AVG(return_percent), 2) as avg_return,
    ROUND(AVG(return_percent) FILTER (WHERE net_pnl > 0), 2) as avg_win,
    ROUND(AVG(return_percent) FILTER (WHERE net_pnl <= 0), 2) as avg_loss,
    ROUND(SUM(net_pnl), 2) as total_pnl,
    ROUND(AVG(alpha), 2) as avg_alpha
FROM experiments
WHERE status = 'closed' AND exit_time IS NOT NULL
GROUP BY date(exit_time)
ORDER BY trade_date DESC;

-- Представление для wave analysis
CREATE OR REPLACE VIEW wave_performance AS
SELECT
    s.wave,
    COUNT(*) as trades_count,
    COUNT(*) FILTER (WHERE e.net_pnl > 0) as winning_trades,
    ROUND(COUNT(*) FILTER (WHERE e.net_pnl > 0)::NUMERIC / COUNT(*) * 100, 2) as win_rate,
    ROUND(AVG(e.return_percent), 2) as avg_return,
    ROUND(AVG(e.alpha), 2) as avg_alpha,
    ROUND(SUM(e.net_pnl), 2) as total_pnl
FROM experiments e
JOIN signals s ON e.signal_id = s.id
WHERE e.status = 'closed'
GROUP BY s.wave
ORDER BY s.wave;

-- Начальный снимок портфеля
INSERT INTO portfolio_snapshots (
    total_value,
    cash_balance,
    positions_count,
    daily_return,
    total_return
) VALUES (
    10000, -- INITIAL_CAPITAL
    10000, -- все в кеше изначально
    0,     -- нет позиций
    0,     -- нет доходности
    0      -- нет доходности
) ON CONFLICT (timestamp) DO NOTHING;