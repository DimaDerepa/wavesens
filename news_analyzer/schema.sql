CREATE TABLE news (
    id VARCHAR(100) PRIMARY KEY,  -- "finnhub:12345"
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    significance_score INTEGER,    -- 0-100
    reasoning TEXT,                -- почему важно/неважно
    is_significant BOOLEAN,        -- score >= 70
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_processed_at ON news(processed_at DESC);
CREATE INDEX idx_significant ON news(is_significant) WHERE is_significant = TRUE;