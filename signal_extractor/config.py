#!/usr/bin/env python3
"""
Configuration for Signal Extractor - БЛОК 2
"""
import os
import logging

class Config:
    # API конфигурация
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/news_analyzer')

    # LLM настройки
    LLM_MODEL = os.getenv('LLM_MODEL', 'anthropic/claude-3-haiku')
    LLM_TEMPERATURE = float(os.getenv('LLM_TEMPERATURE', '0.4'))
    LLM_MAX_TOKENS = int(os.getenv('LLM_MAX_TOKENS', '2000'))
    LLM_TIMEOUT_SECONDS = int(os.getenv('LLM_TIMEOUT_SECONDS', '30'))

    # Параметры сигналов
    MIN_EXPECTED_MOVE_PERCENT = float(os.getenv('MIN_EXPECTED_MOVE_PERCENT', '1.0'))
    MIN_CONFIDENCE = int(os.getenv('MIN_CONFIDENCE', '40'))
    MAX_SIGNALS_PER_NEWS = int(os.getenv('MAX_SIGNALS_PER_NEWS', '10'))

    # Риск-менеджмент (значения по умолчанию)
    DEFAULT_STOP_LOSS_PERCENT = float(os.getenv('DEFAULT_STOP_LOSS_PERCENT', '2.0'))
    DEFAULT_TAKE_PROFIT_PERCENT = float(os.getenv('DEFAULT_TAKE_PROFIT_PERCENT', '3.0'))
    DEFAULT_MAX_HOLD_HOURS = int(os.getenv('DEFAULT_MAX_HOLD_HOURS', '6'))

    # Логирование
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    # Волновые интервалы (в минутах)
    WAVE_INTERVALS = {
        0: (0, 5),      # 0-5 минут - HFT алгоритмы
        1: (5, 30),     # 5-30 минут - Smart money
        2: (30, 120),   # 30-120 минут - Институционалы
        3: (120, 360),  # 2-6 часов - Информированный retail
        4: (360, 1440), # 6-24 часа - Массовый retail
        5: (1440, 4320), # 1-3 дня - Переоценка
        6: (4320, 10080), # 3-7 дней - Фундаментальный сдвиг
    }

    def validate(self):
        """Проверяем обязательные переменные"""
        if not self.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY required")

        # Logging is now handled by shared_logging.py


    def get_wave_info(self, minutes_old):
        """Определяет статус волн на основе возраста новости"""
        wave_status = {}

        for wave, (start_min, end_min) in self.WAVE_INTERVALS.items():
            if minutes_old < start_min:
                status = "upcoming"
            elif start_min <= minutes_old <= end_min:
                status = "ongoing"
            else:
                status = "missed"

            wave_status[wave] = {
                'status': status,
                'start_min': start_min,
                'end_min': end_min,
                'time_left': max(0, end_min - minutes_old) if status == "ongoing" else 0
            }

        return wave_status