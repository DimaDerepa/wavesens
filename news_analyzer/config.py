#!/usr/bin/env python3
"""
Configuration for News Analyzer
"""
import os
import logging

class Config:
    # Обязательные
    FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/news_analyzer')

    # Опциональные
    SIGNIFICANCE_THRESHOLD = int(os.getenv('SIGNIFICANCE_THRESHOLD', '70'))
    CHECK_INTERVAL_SECONDS = int(os.getenv('CHECK_INTERVAL_SECONDS', '5'))
    SKIP_NEWS_OLDER_HOURS = int(os.getenv('SKIP_NEWS_OLDER_HOURS', '24'))
    MAX_NEWS_PER_CHECK = int(os.getenv('MAX_NEWS_PER_CHECK', '20'))
    LLM_MODEL = os.getenv('LLM_MODEL', 'anthropic/claude-3-haiku')
    LLM_TEMPERATURE = float(os.getenv('LLM_TEMPERATURE', '0.3'))
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    def validate(self):
        """Проверяем обязательные переменные"""
        if not self.FINNHUB_API_KEY:
            raise ValueError("FINNHUB_API_KEY required")
        if not self.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY required")

        # Настройка логирования
        logging.basicConfig(
            level=getattr(logging, self.LOG_LEVEL),
            format='[%(asctime)s] %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

