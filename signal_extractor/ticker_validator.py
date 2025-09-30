#!/usr/bin/env python3
"""
Ticker Validation using yfinance - БЛОК 2
"""
import yfinance as yf
import logging
from typing import Dict, Set
import time

logger = logging.getLogger(__name__)

class TickerValidator:
    def __init__(self):
        # Кеш валидированных тикеров
        self.valid_tickers: Set[str] = set()
        self.invalid_tickers: Set[str] = set()
        self.last_cache_clear = time.time()
        self.cache_duration = 3600  # 1 час

    def validate_ticker(self, ticker: str) -> Dict[str, any]:
        """Валидирует тикер через yfinance"""
        ticker = ticker.upper().strip()

        # Очищаем кеш каждый час
        self._clear_old_cache()

        # Проверяем кеш
        if ticker in self.valid_tickers:
            logger.debug(f"Ticker {ticker} found in valid cache")
            return {
                'ticker': ticker,
                'exists': True,
                'cached': True,
                'info': None
            }

        if ticker in self.invalid_tickers:
            logger.debug(f"Ticker {ticker} found in invalid cache")
            return {
                'ticker': ticker,
                'exists': False,
                'cached': True,
                'info': None
            }

        # Валидируем через yfinance
        try:
            logger.debug(f"Validating ticker {ticker} via yfinance...")

            stock = yf.Ticker(ticker)
            info = stock.info

            # Проверяем, что получили реальные данные
            if self._is_valid_info(info, ticker):
                self.valid_tickers.add(ticker)
                logger.debug(f"Ticker {ticker} validated successfully")

                return {
                    'ticker': ticker,
                    'exists': True,
                    'cached': False,
                    'info': {
                        'name': info.get('longName', info.get('shortName', ticker)),
                        'sector': info.get('sector'),
                        'marketCap': info.get('marketCap'),
                        'currency': info.get('currency', 'USD')
                    }
                }
            else:
                self.invalid_tickers.add(ticker)
                logger.warning(f"Ticker {ticker} validation failed - invalid data")

                return {
                    'ticker': ticker,
                    'exists': False,
                    'cached': False,
                    'info': None
                }

        except Exception as e:
            logger.warning(f"Ticker {ticker} validation failed: {e}")
            # НЕ кэшируем как invalid если это временная ошибка (429, network)
            # self.invalid_tickers.add(ticker)

            return {
                'ticker': ticker,
                'exists': False,  # Не подтверждён, но и не отклонён
                'cached': False,
                'info': None,
                'error': str(e)
            }

    def validate_multiple(self, tickers: list) -> Dict[str, Dict]:
        """Валидирует несколько тикеров"""
        results = {}

        for ticker in tickers:
            results[ticker] = self.validate_ticker(ticker)
            # Небольшая задержка чтобы не спамить yfinance
            time.sleep(0.1)

        return results

    def get_valid_tickers(self, tickers: list) -> list:
        """Возвращает только валидные тикеры из списка"""
        valid = []

        for ticker in tickers:
            result = self.validate_ticker(ticker)
            if result['exists']:
                valid.append(ticker)

        return valid

    def _is_valid_info(self, info: dict, ticker: str) -> bool:
        """Проверяет, что info содержит реальные данные"""
        if not info:
            return False

        # Проверяем наличие ключевых полей
        has_name = bool(info.get('longName') or info.get('shortName'))
        has_market_data = bool(info.get('marketCap') or info.get('totalAssets'))

        # Проверяем, что символ соответствует запрошенному
        symbol_match = info.get('symbol', '').upper() == ticker.upper()

        # Дополнительные проверки
        has_exchange = bool(info.get('exchange'))
        has_currency = bool(info.get('currency'))

        # Тикер считается валидным если есть базовая информация
        is_valid = (has_name or symbol_match) and (has_market_data or has_exchange or has_currency)

        logger.debug(f"Ticker {ticker} validation details:")
        logger.debug(f"  has_name: {has_name}")
        logger.debug(f"  symbol_match: {symbol_match}")
        logger.debug(f"  has_market_data: {has_market_data}")
        logger.debug(f"  has_exchange: {has_exchange}")
        logger.debug(f"  is_valid: {is_valid}")

        return is_valid

    def _clear_old_cache(self):
        """Очищает старый кеш"""
        current_time = time.time()

        if current_time - self.last_cache_clear > self.cache_duration:
            logger.info(f"Clearing ticker cache: {len(self.valid_tickers)} valid, {len(self.invalid_tickers)} invalid")
            self.valid_tickers.clear()
            self.invalid_tickers.clear()
            self.last_cache_clear = current_time

    def get_cache_stats(self):
        """Возвращает статистику кеша"""
        return {
            'valid_count': len(self.valid_tickers),
            'invalid_count': len(self.invalid_tickers),
            'cache_age_minutes': (time.time() - self.last_cache_clear) / 60
        }