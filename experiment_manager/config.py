#!/usr/bin/env python3
"""
Configuration for Experiment Manager - БЛОК 3
"""
import os
import logging

class Config:
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/news_analyzer')

    # Portfolio parameters
    INITIAL_CAPITAL = float(os.getenv('INITIAL_CAPITAL', '10000'))
    MIN_CASH_RESERVE_PERCENT = float(os.getenv('MIN_CASH_RESERVE_PERCENT', '10'))
    MAX_POSITION_PERCENT = float(os.getenv('MAX_POSITION_PERCENT', '10'))
    MIN_POSITION_SIZE = float(os.getenv('MIN_POSITION_SIZE', '100'))
    MAX_CONCURRENT_POSITIONS = int(os.getenv('MAX_CONCURRENT_POSITIONS', '20'))

    # Risk Management
    DAILY_LOSS_LIMIT_PERCENT = float(os.getenv('DAILY_LOSS_LIMIT_PERCENT', '5'))
    DEFAULT_STOP_LOSS_PERCENT = float(os.getenv('DEFAULT_STOP_LOSS_PERCENT', '3'))
    DEFAULT_TAKE_PROFIT_PERCENT = float(os.getenv('DEFAULT_TAKE_PROFIT_PERCENT', '5'))
    TRAILING_STOP_ACTIVATION_PERCENT = float(os.getenv('TRAILING_STOP_ACTIVATION_PERCENT', '2'))
    TRAILING_STOP_DISTANCE_PERCENT = float(os.getenv('TRAILING_STOP_DISTANCE_PERCENT', '1.5'))

    # Execution costs
    COMMISSION_FIXED = float(os.getenv('COMMISSION_FIXED', '1.0'))
    COMMISSION_PERCENT = float(os.getenv('COMMISSION_PERCENT', '0.1'))
    SLIPPAGE_LIQUID_PERCENT = float(os.getenv('SLIPPAGE_LIQUID_PERCENT', '0.05'))
    SLIPPAGE_ILLIQUID_PERCENT = float(os.getenv('SLIPPAGE_ILLIQUID_PERCENT', '0.2'))
    LIQUIDITY_THRESHOLD_VOLUME = int(os.getenv('LIQUIDITY_THRESHOLD_VOLUME', '1000000'))

    # Position Sizing
    BASE_POSITION_PERCENT = float(os.getenv('BASE_POSITION_PERCENT', '2.0'))
    CONFIDENCE_FACTOR_MIN = float(os.getenv('CONFIDENCE_FACTOR_MIN', '0.5'))
    CONFIDENCE_FACTOR_MAX = float(os.getenv('CONFIDENCE_FACTOR_MAX', '1.5'))
    VOLATILITY_FACTOR_MIN = float(os.getenv('VOLATILITY_FACTOR_MIN', '0.5'))
    CORRELATION_FACTOR_MIN = float(os.getenv('CORRELATION_FACTOR_MIN', '0.5'))

    # Monitoring intervals
    POSITION_CHECK_INTERVAL_SECONDS = int(os.getenv('POSITION_CHECK_INTERVAL_SECONDS', '30'))
    PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS = int(os.getenv('PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS', '300'))
    PRICE_CACHE_TTL_SECONDS = int(os.getenv('PRICE_CACHE_TTL_SECONDS', '30'))

    # Market Data APIs
    YAHOO_FINANCE_API_KEY = os.getenv('YAHOO_FINANCE_API_KEY')  # Опционально
    ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')  # Fallback

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

    def validate(self):
        """Проверяем обязательные параметры"""
        # Настройка логирования
        logging.basicConfig(
            level=getattr(logging, self.LOG_LEVEL),
            format='[%(asctime)s] %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


        # Валидация параметров
        if self.INITIAL_CAPITAL <= 0:
            raise ValueError("INITIAL_CAPITAL must be positive")

        if self.MIN_CASH_RESERVE_PERCENT < 0 or self.MIN_CASH_RESERVE_PERCENT > 50:
            raise ValueError("MIN_CASH_RESERVE_PERCENT must be between 0 and 50")

        if self.MAX_POSITION_PERCENT <= 0 or self.MAX_POSITION_PERCENT > 50:
            raise ValueError("MAX_POSITION_PERCENT must be between 0 and 50")

        if self.DAILY_LOSS_LIMIT_PERCENT <= 0 or self.DAILY_LOSS_LIMIT_PERCENT > 20:
            raise ValueError("DAILY_LOSS_LIMIT_PERCENT must be between 0 and 20")

        if self.BASE_POSITION_PERCENT <= 0 or self.BASE_POSITION_PERCENT > 10:
            raise ValueError("BASE_POSITION_PERCENT must be between 0 and 10")

    def get_benchmark_tickers(self):
        """Возвращает список бенчмарк тикеров"""
        return {
            'SP500': 'SPY',     # S&P 500 - основной бенчмарк
            'NASDAQ': 'QQQ',    # Для tech-heavy дней
            'RUSSELL': 'IWM',   # Для small-cap дней
            'CASH': None        # Risk-free rate (0%)
        }

    def calculate_commission(self, position_size):
        """Рассчитывает комиссию за сделку"""
        commission_percent = position_size * (self.COMMISSION_PERCENT / 100)
        return max(self.COMMISSION_FIXED, commission_percent)

    def calculate_slippage(self, price, volume=None):
        """Рассчитывает slippage на основе ликвидности"""
        if volume and volume < self.LIQUIDITY_THRESHOLD_VOLUME:
            slippage_percent = self.SLIPPAGE_ILLIQUID_PERCENT
        else:
            slippage_percent = self.SLIPPAGE_LIQUID_PERCENT

        return price * (slippage_percent / 100)

    def calculate_position_size(self, portfolio_value, confidence, volatility_factor=1.0, correlation_factor=1.0):
        """Рассчитывает размер позиции с учетом всех факторов"""
        # Базовый размер
        base_size = portfolio_value * (self.BASE_POSITION_PERCENT / 100)

        # Корректировка на confidence (50-150%)
        confidence_factor = max(
            self.CONFIDENCE_FACTOR_MIN,
            min(self.CONFIDENCE_FACTOR_MAX, confidence / 100)
        )

        # Корректировка на волатильность
        volatility_factor = max(self.VOLATILITY_FACTOR_MIN, volatility_factor)

        # Корректировка на корреляцию с портфелем
        correlation_factor = max(self.CORRELATION_FACTOR_MIN, correlation_factor)

        # Итоговый размер
        adjusted_size = base_size * confidence_factor * volatility_factor * correlation_factor

        # Лимиты
        max_position = portfolio_value * (self.MAX_POSITION_PERCENT / 100)

        return min(adjusted_size, max_position)

    def is_position_size_valid(self, position_size, available_cash):
        """Проверяет валидность размера позиции"""
        if position_size < self.MIN_POSITION_SIZE:
            return False, f"Position size {position_size} below minimum {self.MIN_POSITION_SIZE}"

        if position_size > available_cash:
            return False, f"Position size {position_size} exceeds available cash {available_cash}"

        return True, ""

    def get_risk_limits(self):
        """Возвращает словарь с лимитами риска"""
        return {
            'daily_loss_limit': self.DAILY_LOSS_LIMIT_PERCENT,
            'max_position_percent': self.MAX_POSITION_PERCENT,
            'max_concurrent_positions': self.MAX_CONCURRENT_POSITIONS,
            'min_cash_reserve': self.MIN_CASH_RESERVE_PERCENT,
            'default_stop_loss': self.DEFAULT_STOP_LOSS_PERCENT,
            'default_take_profit': self.DEFAULT_TAKE_PROFIT_PERCENT
        }