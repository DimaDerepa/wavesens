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
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def is_duplicate(self, news_id):
        """Проверка дубликата"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1 FROM news WHERE id = %s", (news_id,))
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
                INSERT INTO news (id, headline, summary, url, published_at,
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
                FROM news
                WHERE processed_at > %s
            """, (since,))
            return dict(cursor.fetchone())
        except Exception as e:
            logger.error(f"Stats query failed: {e}")
            return {'total': 0, 'significant': 0, 'avg_score': 0}