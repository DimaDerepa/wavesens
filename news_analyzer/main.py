#!/usr/bin/env python3
"""
Main News Analyzer Service
"""
import time
import signal
import sys
import requests
import logging
from datetime import datetime, timezone, timedelta

from config import Config
from storage import NewsStorage
from analyzer import NewsAnalyzer

logger = logging.getLogger(__name__)

class NewsAnalyzerService:
    def __init__(self):
        self.config = Config()
        self.config.validate()

        self.storage = NewsStorage(self.config.DATABASE_URL)
        self.analyzer = NewsAnalyzer(
            self.config.OPENROUTER_API_KEY,
            self.config.LLM_MODEL,
            self.config.LLM_TEMPERATURE
        )

        self.running = True
        self.stats = {
            'checks': 0,
            'news_processed': 0,
            'significant_found': 0,
            'llm_calls': 0,
            'errors': 0,
            'start_time': datetime.now()
        }

        # Обработка сигналов
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)

    def shutdown(self, signum, frame):
        """Graceful shutdown"""
        logger.info("Shutting down (SIGINT received)")
        total_processed = self.stats['news_processed']
        significant = self.stats['significant_found']
        logger.info(f"Final stats: processed {total_processed} news, found {significant} significant")
        self.running = False

    def fetch_finnhub_news(self):
        """Получение новостей из Finnhub"""
        try:
            url = "https://finnhub.io/api/v1/news"
            params = {
                'category': 'general',
                'token': self.config.FINNHUB_API_KEY
            }

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            news_items = response.json()
            logger.debug(f"Got {len(news_items)} news items")

            return news_items[:self.config.MAX_NEWS_PER_CHECK]

        except requests.exceptions.RequestException as e:
            logger.error(f"Finnhub API error: {e}")
            self.stats['errors'] += 1
            return []

    def is_news_too_old(self, published_timestamp):
        """Проверка возраста новости"""
        news_time = datetime.fromtimestamp(published_timestamp, tz=timezone.utc)
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.config.SKIP_NEWS_OLDER_HOURS)
        return news_time < cutoff_time

    def process_news_item(self, item):
        """Обработка одной новости"""
        try:
            # Извлекаем данные
            news_id = f"finnhub:{item['id']}"
            headline = item.get('headline', '')
            summary = item.get('summary', '')
            url = item.get('url', '')
            published_at = datetime.fromtimestamp(item['datetime'], tz=timezone.utc)

            # Проверки
            if self.storage.is_duplicate(news_id):
                logger.debug(f"Skipping duplicate: {news_id} already processed")
                return

            if self.is_news_too_old(item['datetime']):
                hours_old = (datetime.now(timezone.utc) - published_at).total_seconds() / 3600
                logger.debug(f"Skipping old news ({hours_old:.0f} hours): {headline[:50]}...")
                return

            logger.debug(f"Processing: {headline[:50]}...")

            # LLM анализ
            score, is_significant, reasoning = self.analyzer.analyze(headline, summary)
            self.stats['llm_calls'] += 1

            logger.debug(f"LLM response: score={score}, reasoning={reasoning[:50]}...")

            # Сохранение в БД
            success = self.storage.save_news(
                news_id, headline, summary, url, published_at,
                score, reasoning, is_significant
            )

            if success:
                self.stats['news_processed'] += 1
                if is_significant:
                    self.stats['significant_found'] += 1
                    logger.info(f"📰 SIGNIFICANT [{score}]: {headline[:80]}...")
                else:
                    logger.debug(f"Not significant [{score}]: {headline[:50]}...")
            else:
                self.stats['errors'] += 1

        except Exception as e:
            logger.error(f"Processing failed for news item: {e}")
            self.stats['errors'] += 1

    def log_hourly_stats(self):
        """Логирование статистики каждый час"""
        uptime = datetime.now() - self.stats['start_time']
        uptime_str = str(uptime).split('.')[0]  # Убираем микросекунды

        db_stats = self.storage.get_stats(hours=1)
        percentage = (db_stats['significant'] / max(db_stats['total'], 1)) * 100

        logger.info("📊 Hourly stats:")
        logger.info(f"  Checks: {self.stats['checks']}")
        logger.info(f"  News processed: {db_stats['total']}")
        logger.info(f"  Significant: {db_stats['significant']} ({percentage:.1f}%)")
        logger.info(f"  LLM calls: {self.stats['llm_calls']}")
        logger.info(f"  LLM tokens used: ~{self.stats['llm_calls'] * 200:,}")
        logger.info(f"  Errors: {self.stats['errors']}")
        logger.info(f"  Uptime: {uptime_str}")

    def run(self):
        """Основной цикл"""
        logger.info("Starting News Analyzer")
        logger.info(f"Config: threshold={self.config.SIGNIFICANCE_THRESHOLD}, interval={self.config.CHECK_INTERVAL_SECONDS}s, model={self.config.LLM_MODEL}")

        last_hourly_log = datetime.now()

        while self.running:
            try:
                # Каждый час логируем статистику
                if datetime.now() - last_hourly_log >= timedelta(hours=1):
                    self.log_hourly_stats()
                    last_hourly_log = datetime.now()

                # Основная работа
                logger.debug("Fetching news from Finnhub...")
                news_items = self.fetch_finnhub_news()
                self.stats['checks'] += 1

                for item in news_items:
                    if not self.running:
                        break
                    self.process_news_item(item)

                # Пауза
                time.sleep(self.config.CHECK_INTERVAL_SECONDS)

            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                self.stats['errors'] += 1
                time.sleep(self.config.CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    service = NewsAnalyzerService()
    service.run()