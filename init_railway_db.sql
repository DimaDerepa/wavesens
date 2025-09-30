-- Combined schema initialization for Railway PostgreSQL
-- Execute this via Railway database console or psql connection

-- News Analyzer schema
CREATE TABLE IF NOT EXISTS news_items (
    id SERIAL PRIMARY KEY,
    news_id VARCHAR(255) UNIQUE NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT,
    url VARCHAR(500),
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    significance_score DECIMAL(5,2),
    reasoning TEXT,
    is_significant BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_items_news_id ON news_items(news_id);
CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at);
CREATE INDEX IF NOT EXISTS idx_news_items_is_significant ON news_items(is_significant);
CREATE INDEX IF NOT EXISTS idx_news_items_processed_at ON news_items(processed_at);

-- Signal Extractor schema
CREATE TABLE IF NOT EXISTS trading_signals (
    id SERIAL PRIMARY KEY,
    news_item_id INTEGER REFERENCES news_items(id),
    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    elliott_wave INTEGER NOT NULL CHECK (elliott_wave >= 0 AND elliott_wave <= 6),
    wave_description TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    market_conditions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_signals_news_item_id ON trading_signals(news_item_id);
CREATE INDEX IF NOT EXISTS idx_trading_signals_signal_type ON trading_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_trading_signals_elliott_wave ON trading_signals(elliott_wave);
CREATE INDEX IF NOT EXISTS idx_trading_signals_created_at ON trading_signals(created_at);

-- Experiment Manager schema
CREATE TABLE IF NOT EXISTS experiments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_balance DECIMAL(12,2) NOT NULL,
    current_balance DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio snapshots table for portfolio tracking
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() UNIQUE,
    total_value DECIMAL(12,2) NOT NULL,
    cash_balance DECIMAL(12,2) NOT NULL,
    positions_count INTEGER DEFAULT 0,
    unrealized_pnl DECIMAL(12,2) DEFAULT 0,
    realized_pnl_today DECIMAL(12,2) DEFAULT 0,
    realized_pnl_total DECIMAL(12,2) DEFAULT 0,
    daily_return DECIMAL(8,4) DEFAULT 0,
    total_return DECIMAL(8,4) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id),
    signal_id INTEGER REFERENCES trading_signals(id),
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    commission DECIMAL(8,4) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_trades_experiment_id ON trades(experiment_id);
CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

-- Create NOTIFY triggers for real-time communication
CREATE OR REPLACE FUNCTION notify_new_significant_news()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_significant = TRUE THEN
        PERFORM pg_notify('new_significant_news', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_new_signal()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_trading_signal',
        json_build_object(
            'id', NEW.id,
            'news_item_id', NEW.news_item_id,
            'signal_type', NEW.signal_type,
            'confidence', NEW.confidence,
            'elliott_wave', NEW.elliott_wave,
            'wave_description', NEW.wave_description
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_significant_news ON news_items;
CREATE TRIGGER trigger_notify_significant_news
    AFTER INSERT OR UPDATE ON news_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_significant_news();

DROP TRIGGER IF EXISTS trigger_notify_new_signal ON trading_signals;
CREATE TRIGGER trigger_notify_new_signal
    AFTER INSERT ON trading_signals
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_signal();

-- Insert sample experiment for testing
INSERT INTO experiments (name, description, start_date, end_date, initial_balance, current_balance, settings)
VALUES (
    'WaveSens Demo Trading',
    'Demonstration experiment using Elliott Wave analysis for news-driven trading signals',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    10000.00,
    10000.00,
    '{"risk_per_trade": 0.02, "max_trades_per_day": 5, "enable_weekend_trading": false}'::jsonb
) ON CONFLICT DO NOTHING;