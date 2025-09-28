#!/usr/bin/env python3
"""
Database storage for News Analyzer
"""
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class NewsStorage:
    def __init__(self, database_url):
        self.database_url = database_url
        self.conn = None
        self.connect()

    def connect(self):
        """Подключение к БД"""
        try:
            self.conn = psycopg2.connect(self.database_url)
            self.conn.autocommit = True
            logger.info("Database connected")

            # Создаем таблицу news_items если её нет
            cursor = self.conn.cursor()

            # Проверяем и добавляем недостающие колонки
            missing_columns = ['summary', 'url', 'reasoning', 'significance_score', 'is_significant']

            for col_name in missing_columns:
                cursor.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'news_items' AND column_name = %s
                """, (col_name,))

                if not cursor.fetchone():
                    try:
                        if col_name == 'summary':
                            cursor.execute("ALTER TABLE news_items ADD COLUMN summary TEXT")
                        elif col_name == 'url':
                            cursor.execute("ALTER TABLE news_items ADD COLUMN url VARCHAR(500)")
                        elif col_name == 'reasoning':
                            cursor.execute("ALTER TABLE news_items ADD COLUMN reasoning TEXT")
                        elif col_name == 'significance_score':
                            cursor.execute("ALTER TABLE news_items ADD COLUMN significance_score DECIMAL(3,2)")
                        elif col_name == 'is_significant':
                            cursor.execute("ALTER TABLE news_items ADD COLUMN is_significant BOOLEAN DEFAULT FALSE")
                        logger.info(f"Added {col_name} column to news_items")
                    except Exception as e:
                        logger.debug(f"Could not add {col_name} column: {e}")
                        pass  # Таблицы может не быть вообще

            cursor.execute("""
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
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_news_items_news_id ON news_items(news_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_news_items_is_significant ON news_items(is_significant)
            """)
            cursor.close()
            logger.info("News items table initialized")

        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def is_duplicate(self, news_id):
        """Проверка дубликата"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1 FROM news_items WHERE news_id = %s", (news_id,))
            return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"Duplicate check failed: {e}")
            return False

    def save_news(self, news_id, headline, summary, url, published_at,
                  significance_score, reasoning, is_significant):
        """Сохранение новости в БД"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO news_items (news_id, headline, summary, url, published_at,
                                significance_score, reasoning, is_significant)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (news_id, headline, summary, url, published_at,
                  significance_score, reasoning, is_significant))
            return True
        except Exception as e:
            logger.error(f"Save news failed: {e}")
            return False

    def get_stats(self, hours=1):
        """Статистика за последние N часов"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            since = datetime.now() - timedelta(hours=hours)
            cursor.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_significant = TRUE) as significant,
                    AVG(significance_score) as avg_score
                FROM news_items
                WHERE processed_at > %s
            """, (since,))
            return dict(cursor.fetchone())
        except Exception as e:
            logger.error(f"Stats query failed: {e}")
            return {'total': 0, 'significant': 0, 'avg_score': 0}