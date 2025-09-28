#!/usr/bin/env python3
"""
Скрипт для инициализации БД в Railway
Запусти его с DATABASE_URL из Railway
"""
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def init_database(database_url):
    """Инициализирует все таблицы в БД"""

    try:
        # Подключаемся к БД
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("✅ Подключено к БД")

        # Создаем таблицы
        tables = [
            # News Items
            """
            CREATE TABLE IF NOT EXISTS news_items (
                id SERIAL PRIMARY KEY,
                news_id VARCHAR(255) UNIQUE NOT NULL,
                headline TEXT NOT NULL,
                summary TEXT,
                url VARCHAR(500),
                published_at TIMESTAMP WITH TIME ZONE NOT NULL,
                processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                significance_score DECIMAL(3,2),
                reasoning TEXT,
                is_significant BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """,

            # Trading Signals
            """
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
            )
            """,

            # Experiments
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                start_date DATE NOT NULL DEFAULT CURRENT_DATE,
                end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
                initial_balance DECIMAL(12,2) NOT NULL DEFAULT 10000,
                current_balance DECIMAL(12,2) NOT NULL DEFAULT 10000,
                status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
                position_size DECIMAL(12,2) DEFAULT 0,
                settings JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """,

            # Portfolio Snapshots (ВАЖНАЯ ТАБЛИЦА!)
            """
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
            )
            """,

            # Trades
            """
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
            )
            """
        ]

        # Создаем каждую таблицу
        for i, table_sql in enumerate(tables, 1):
            cursor.execute(table_sql)
            print(f"✅ Таблица {i}/5 создана")

        # Создаем индексы
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_news_items_news_id ON news_items(news_id)",
            "CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at)",
            "CREATE INDEX IF NOT EXISTS idx_news_items_is_significant ON news_items(is_significant)",
            "CREATE INDEX IF NOT EXISTS idx_trading_signals_news_item_id ON trading_signals(news_item_id)",
            "CREATE INDEX IF NOT EXISTS idx_trading_signals_signal_type ON trading_signals(signal_type)",
            "CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_trades_experiment_id ON trades(experiment_id)",
            "CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status)"
        ]

        for index_sql in indexes:
            cursor.execute(index_sql)
        print("✅ Индексы созданы")

        # Создаем NOTIFY функции
        cursor.execute("""
            CREATE OR REPLACE FUNCTION notify_new_significant_news()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.is_significant = TRUE THEN
                    PERFORM pg_notify('significant_news',
                        json_build_object(
                            'id', NEW.id,
                            'news_id', NEW.news_id,
                            'headline', NEW.headline,
                            'score', NEW.significance_score,
                            'published_at', NEW.published_at
                        )::text
                    );
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)

        cursor.execute("""
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
            $$ LANGUAGE plpgsql
        """)
        print("✅ NOTIFY функции созданы")

        # Создаем триггеры
        cursor.execute("""
            DROP TRIGGER IF EXISTS trigger_notify_significant_news ON news_items;
            CREATE TRIGGER trigger_notify_significant_news
                AFTER INSERT OR UPDATE ON news_items
                FOR EACH ROW
                EXECUTE FUNCTION notify_new_significant_news()
        """)

        cursor.execute("""
            DROP TRIGGER IF EXISTS trigger_notify_new_signal ON trading_signals;
            CREATE TRIGGER trigger_notify_new_signal
                AFTER INSERT ON trading_signals
                FOR EACH ROW
                EXECUTE FUNCTION notify_new_signal()
        """)
        print("✅ Триггеры созданы")

        # Создаем демо эксперимент
        cursor.execute("""
            INSERT INTO experiments (name, description, initial_balance, current_balance, settings)
            VALUES (
                'WaveSens Demo Trading',
                'Demonstration experiment using Elliott Wave analysis',
                10000.00,
                10000.00,
                '{"risk_per_trade": 0.02, "max_trades_per_day": 5}'::jsonb
            ) ON CONFLICT DO NOTHING
        """)
        print("✅ Демо эксперимент создан")

        # Проверяем таблицы
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)

        tables = cursor.fetchall()
        print("\n📊 Созданные таблицы:")
        for table in tables:
            print(f"  - {table[0]}")

        cursor.close()
        conn.close()

        print("\n✅ БД успешно инициализирована!")

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Получаем DATABASE_URL из аргумента или переменной окружения
    if len(sys.argv) > 1:
        database_url = sys.argv[1]
    else:
        database_url = os.getenv('DATABASE_URL')

    if not database_url:
        print("❌ Ошибка: Укажи DATABASE_URL")
        print("\nИспользование:")
        print("  python init_db.py 'postgresql://user:pass@host:port/db'")
        print("или")
        print("  export DATABASE_URL='postgresql://...'")
        print("  python init_db.py")
        sys.exit(1)

    init_database(database_url)