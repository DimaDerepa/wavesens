#!/usr/bin/env python3
"""
Migrate experiments table to trading positions structure
"""
import sys
import os
from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

import psycopg2

try:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    print("🔄 Dropping old experiments table...")
    cur.execute("DROP TABLE IF EXISTS experiments CASCADE;")

    print("✅ Creating new experiments table for trading positions...")
    cur.execute("""
        CREATE TABLE experiments (
            id SERIAL PRIMARY KEY,
            signal_id INTEGER,
            news_id INTEGER,
            ticker VARCHAR(10) NOT NULL,
            entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            entry_price DECIMAL(10,4) NOT NULL,
            position_size DECIMAL(12,2) NOT NULL,
            shares DECIMAL(12,6) NOT NULL,
            commission_paid DECIMAL(8,4) DEFAULT 0,
            stop_loss_price DECIMAL(10,4),
            take_profit_price DECIMAL(10,4),
            max_hold_until TIMESTAMP WITH TIME ZONE,
            sp500_entry DECIMAL(10,4),
            exit_time TIMESTAMP WITH TIME ZONE,
            exit_price DECIMAL(10,4),
            exit_reason VARCHAR(50),
            gross_pnl DECIMAL(12,2),
            net_pnl DECIMAL(12,2),
            return_percent DECIMAL(8,4),
            hold_duration INTEGER,
            sp500_exit DECIMAL(10,4),
            sp500_return DECIMAL(8,4),
            alpha DECIMAL(8,4),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)

    print("✅ Creating indexes...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_experiments_ticker ON experiments(ticker);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_experiments_entry_time ON experiments(entry_time);")

    conn.commit()
    print("✅ Migration successful!")

except Exception as e:
    print(f"❌ Migration failed: {e}")
    sys.exit(1)
finally:
    if cur:
        cur.close()
    if conn:
        conn.close()
