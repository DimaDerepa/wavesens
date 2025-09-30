#!/usr/bin/env python3
"""
Market Data Provider - БЛОК 3
Получение реальных цен из Yahoo Finance и Alpha Vantage
"""
import yfinance as yf
import requests
import time
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

class MarketDataProvider:
    def __init__(self, alpha_vantage_key=None, finnhub_key=None):
        self.alpha_vantage_key = alpha_vantage_key
        self.finnhub_key = finnhub_key
        self.price_cache = {}
        self.cache_ttl = 300  # 5 минут
        self.stale_cache_ttl = 3600  # 1 час - используем для fallback
        self.last_yahoo_request = 0
        self.yahoo_rate_limit_delay = 3.0  # 3 секунды между запросами
        self.yahoo_blocked = False  # Флаг блокировки Yahoo
        self.yahoo_block_until = 0  # Время до которого не пытаться Yahoo

    def get_current_price(self, ticker: str, allow_stale=False) -> Optional[float]:
        """Получает текущую цену тикера с умным fallback"""
        # Проверяем свежий кеш
        cached_data = self.price_cache.get(ticker)
        if cached_data:
            cache_age = time.time() - cached_data['timestamp']
            if cache_age < self.cache_ttl:
                logger.debug(f"Using cached price for {ticker}: ${cached_data['price']:.2f}")
                return cached_data['price']
            elif allow_stale and cache_age < self.stale_cache_ttl:
                logger.warning(f"Using STALE cached price for {ticker}: ${cached_data['price']:.2f} (age: {cache_age/60:.1f}m)")
                return cached_data['price']

        # 1. Пробуем Yahoo Finance (если не заблокирован)
        price = None
        if not self.yahoo_blocked or time.time() > self.yahoo_block_until:
            price = self._get_price_yahoo(ticker)
            if price is None and '429' in str(getattr(self, '_last_yahoo_error', '')):
                # Yahoo заблокировал - переключаемся на другие источники
                self.yahoo_blocked = True
                self.yahoo_block_until = time.time() + 600  # 10 минут
                logger.warning(f"Yahoo Finance blocked (429), switching to alternatives for 10 minutes")

        # 2. Fallback на Finnhub
        if price is None and self.finnhub_key:
            logger.info(f"Trying Finnhub for {ticker}")
            price = self._get_price_finnhub(ticker)

        # 3. Fallback на Alpha Vantage
        if price is None and self.alpha_vantage_key:
            logger.info(f"Trying Alpha Vantage for {ticker}")
            price = self._get_price_alpha_vantage(ticker)

        # 4. Используем устаревший кеш как последний fallback
        if price is None and cached_data and allow_stale:
            cache_age = time.time() - cached_data['timestamp']
            logger.warning(f"All sources failed, using STALE cache for {ticker}: ${cached_data['price']:.2f} (age: {cache_age/60:.1f}m)")
            return cached_data['price']

        # Кешируем результат
        if price is not None:
            self.price_cache[ticker] = {
                'price': price,
                'timestamp': time.time()
            }
            logger.info(f"✅ Got price for {ticker}: ${price:.2f}")
        else:
            logger.error(f"❌ Failed to get price for {ticker} from all sources")

        return price

    def _get_price_yahoo(self, ticker: str) -> Optional[float]:
        """Получает цену через Yahoo Finance с rate limiting"""
        try:
            # Aggressive rate limiting
            time_since_last_request = time.time() - self.last_yahoo_request
            if time_since_last_request < self.yahoo_rate_limit_delay:
                sleep_time = self.yahoo_rate_limit_delay - time_since_last_request
                time.sleep(sleep_time)

            self.last_yahoo_request = time.time()

            # Отключаем debug логи yfinance временно
            yf_logger = logging.getLogger('yfinance')
            original_level = yf_logger.level
            yf_logger.setLevel(logging.ERROR)

            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="1d", interval="1m")

                if hist.empty:
                    hist = stock.history(period="5d")

                if hist.empty:
                    self._last_yahoo_error = "No data"
                    return None

                latest_price = hist['Close'].iloc[-1]
                return float(latest_price)
            finally:
                yf_logger.setLevel(original_level)

        except Exception as e:
            self._last_yahoo_error = str(e)
            if '429' in str(e) or 'Too Many Requests' in str(e):
                logger.warning(f"Yahoo Finance 429 for {ticker}")
            else:
                logger.warning(f"Yahoo Finance error for {ticker}: {e}")
            return None

    def _get_price_finnhub(self, ticker: str) -> Optional[float]:
        """Получает цену через Finnhub API"""
        if not self.finnhub_key:
            return None

        try:
            url = f"https://finnhub.io/api/v1/quote"
            params = {
                'symbol': ticker,
                'token': self.finnhub_key
            }

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            # Finnhub возвращает {'c': current_price, 'h': high, 'l': low, ...}
            if 'c' in data and data['c'] > 0:
                price = float(data['c'])
                logger.info(f"Finnhub provided price for {ticker}: ${price:.2f}")
                return price
            else:
                logger.warning(f"No valid price from Finnhub for {ticker}: {data}")
                return None

        except Exception as e:
            logger.warning(f"Finnhub error for {ticker}: {e}")
            return None

    def _get_price_alpha_vantage(self, ticker: str) -> Optional[float]:
        """Получает цену через Alpha Vantage (fallback)"""
        if not self.alpha_vantage_key:
            return None

        try:
            url = f"https://www.alphavantage.co/query"
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': ticker,
                'apikey': self.alpha_vantage_key
            }

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if 'Global Quote' in data and '05. price' in data['Global Quote']:
                price = float(data['Global Quote']['05. price'])
                logger.info(f"Alpha Vantage provided price for {ticker}: ${price:.2f}")
                return price
            else:
                logger.warning(f"No price data from Alpha Vantage for {ticker}")
                return None

        except Exception as e:
            logger.warning(f"Alpha Vantage error for {ticker}: {e}")
            return None

    def get_bid_ask_spread(self, ticker: str) -> Tuple[float, float]:
        """Получает bid/ask спред для расчета более точного slippage"""
        try:
            # НЕ используем stock.info - вызывает 429
            # Вместо этого используем упрощенный расчет на основе текущей цены
            current_price = self.get_current_price(ticker)
            if not current_price:
                return (0.0, 0.0)

            # Оцениваем спред как 0.1% от цены (типичный spread для ликвидных акций)
            spread = current_price * 0.001
            bid = current_price - spread / 2
            ask = current_price + spread / 2

            if bid and ask:
                return float(bid), float(ask)
            else:
                # Если нет bid/ask, используем приблизительный спред 0.1%
                current_price = self.get_current_price(ticker)
                if current_price:
                    spread = current_price * 0.001  # 0.1%
                    return current_price - spread/2, current_price + spread/2

        except Exception as e:
            logger.debug(f"Could not get bid/ask for {ticker}: {e}")

        return None, None

    def get_volume(self, ticker: str) -> Optional[int]:
        """Получает объем торгов для оценки ликвидности"""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")

            if not hist.empty:
                volume = hist['Volume'].iloc[-1]
                return int(volume)

        except Exception as e:
            logger.debug(f"Could not get volume for {ticker}: {e}")

        return None

    def get_benchmark_price(self, benchmark_ticker: str = 'SPY') -> Optional[float]:
        """Получает цену бенчмарка (по умолчанию S&P 500) - разрешаем stale cache"""
        return self.get_current_price(benchmark_ticker, allow_stale=True)

    def calculate_realistic_execution_price(self, ticker: str, side: str, position_size: float) -> Optional[Dict]:
        """
        Рассчитывает реалистичную цену исполнения с учетом:
        - Market price
        - Bid/Ask spread
        - Slippage
        - Market impact
        """
        current_price = self.get_current_price(ticker, allow_stale=False)
        if current_price is None:
            return None

        # Добавляем position_size в результат
        position_size_param = position_size

        bid, ask = self.get_bid_ask_spread(ticker)
        volume = self.get_volume(ticker)

        # Базовый спред
        if bid and ask:
            spread = ask - bid
        else:
            spread = current_price * 0.001  # 0.1% по умолчанию

        # Market impact на основе размера позиции и объема
        market_impact = 0
        if volume:
            position_volume_ratio = position_size / current_price / volume
            if position_volume_ratio > 0.001:  # Если позиция > 0.1% дневного объема
                market_impact = current_price * position_volume_ratio * 0.5

        # Slippage на основе ликвидности
        if volume and volume > 1000000:  # Ликвидный
            slippage = current_price * 0.0005  # 0.05%
        else:  # Неликвидный
            slippage = current_price * 0.002   # 0.2%

        # Итоговая цена исполнения
        if side.upper() == 'BUY':
            execution_price = current_price + spread/2 + slippage + market_impact
        else:  # SELL/SHORT
            execution_price = current_price - spread/2 - slippage - market_impact

        return {
            'market_price': current_price,
            'execution_price': execution_price,
            'spread': spread,
            'slippage': slippage,
            'market_impact': market_impact,
            'total_cost': execution_price - current_price if side.upper() == 'BUY'
                         else current_price - execution_price,
            'volume': volume,
            'position_size': position_size_param
        }

    def get_market_hours_status(self) -> str:
        """Определяет статус рыночных часов"""
        try:
            # Используем статус SPY для определения часов рынка
            spy = yf.Ticker('SPY')
            info = spy.info

            # Эта информация не всегда доступна, поэтому используем простую логику
            return "open"  # Упрощение для MVP

        except Exception:
            return "unknown"

    def clear_cache(self):
        """Очищает кеш цен"""
        self.price_cache.clear()
        logger.info("Price cache cleared")

    def get_cache_stats(self) -> Dict:
        """Возвращает статистику кеша"""
        now = time.time()
        valid_entries = sum(1 for data in self.price_cache.values()
                          if (now - data['timestamp']) < self.cache_ttl)

        return {
            'total_entries': len(self.price_cache),
            'valid_entries': valid_entries,
            'expired_entries': len(self.price_cache) - valid_entries,
            'cache_ttl': self.cache_ttl
        }