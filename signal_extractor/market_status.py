#!/usr/bin/env python3
"""
Market Status Detection - БЛОК 2
"""
from datetime import datetime, timezone, timedelta
from enum import Enum
import pytz
import logging

logger = logging.getLogger(__name__)

class MarketStatus(Enum):
    CLOSED = "closed"
    PRE_MARKET = "pre_market"
    REGULAR_SESSION = "regular_session"
    AFTER_HOURS = "after_hours"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"

class MarketDetector:
    def __init__(self):
        self.eastern = pytz.timezone('US/Eastern')

    def get_current_status(self):
        """Определяет текущий статус рынка"""
        now_utc = datetime.now(timezone.utc)
        now_eastern = now_utc.astimezone(self.eastern)

        return self._determine_status(now_eastern)

    def get_status_at_time(self, timestamp):
        """Определяет статус рынка на конкретное время"""
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        eastern_time = timestamp.astimezone(self.eastern)
        return self._determine_status(eastern_time)

    def _determine_status(self, eastern_time):
        """Внутренняя логика определения статуса"""
        weekday = eastern_time.weekday()  # 0=Monday, 6=Sunday
        hour = eastern_time.hour
        minute = eastern_time.minute
        time_minutes = hour * 60 + minute

        # Выходные (суббота и воскресенье)
        if weekday >= 5:  # Saturday=5, Sunday=6
            return MarketStatus.WEEKEND

        # Определяем время в минутах от начала дня
        pre_market_start = 4 * 60  # 4:00 AM
        regular_start = 9 * 60 + 30  # 9:30 AM
        regular_end = 16 * 60  # 4:00 PM
        after_hours_end = 20 * 60  # 8:00 PM

        if time_minutes < pre_market_start:
            return MarketStatus.CLOSED
        elif pre_market_start <= time_minutes < regular_start:
            return MarketStatus.PRE_MARKET
        elif regular_start <= time_minutes < regular_end:
            return MarketStatus.REGULAR_SESSION
        elif regular_end <= time_minutes < after_hours_end:
            return MarketStatus.AFTER_HOURS
        else:
            return MarketStatus.CLOSED

    def is_market_open(self, status=None):
        """Проверяет, открыт ли рынок для торговли"""
        if status is None:
            status = self.get_current_status()

        return status in [
            MarketStatus.PRE_MARKET,
            MarketStatus.REGULAR_SESSION,
            MarketStatus.AFTER_HOURS
        ]

    def get_next_market_open(self):
        """Возвращает время следующего открытия рынка"""
        now_eastern = datetime.now(self.eastern)
        current_status = self._determine_status(now_eastern)

        if current_status == MarketStatus.REGULAR_SESSION:
            return now_eastern  # Рынок уже открыт

        # Если выходные, ждем понедельника
        if current_status == MarketStatus.WEEKEND:
            days_until_monday = (7 - now_eastern.weekday()) % 7
            if days_until_monday == 0:  # Сегодня воскресенье
                days_until_monday = 1

            next_monday = now_eastern.replace(
                hour=9, minute=30, second=0, microsecond=0
            ) + timedelta(days=days_until_monday)
            return next_monday

        # Если сегодня рабочий день, но рынок закрыт
        if now_eastern.hour < 9 or (now_eastern.hour == 9 and now_eastern.minute < 30):
            # Рынок откроется сегодня в 9:30
            return now_eastern.replace(hour=9, minute=30, second=0, microsecond=0)
        else:
            # Рынок откроется завтра в 9:30
            tomorrow = now_eastern.replace(
                hour=9, minute=30, second=0, microsecond=0
            ) + timedelta(days=1)

            # Если завтра выходной, переносим на понедельник
            if tomorrow.weekday() >= 5:
                days_until_monday = (7 - tomorrow.weekday()) % 7 + 1
                tomorrow += timedelta(days=days_until_monday)

            return tomorrow

    def get_wave_delay_info(self, news_age_minutes, current_status=None):
        """Определяет, задерживаются ли волны из-за закрытого рынка"""
        if current_status is None:
            current_status = self.get_current_status()

        # Если рынок открыт, волны идут по плану
        if self.is_market_open(current_status):
            return {
                'delayed': False,
                'reason': None,
                'next_opportunity': None
            }

        # Рынок закрыт - волны задерживаются
        next_open = self.get_next_market_open()

        reason_map = {
            MarketStatus.CLOSED: "Market closed",
            MarketStatus.WEEKEND: "Weekend",
            MarketStatus.HOLIDAY: "Market holiday"
        }

        return {
            'delayed': True,
            'reason': reason_map.get(current_status, "Market closed"),
            'next_opportunity': next_open,
            'hours_until_open': (next_open - datetime.now(self.eastern)).total_seconds() / 3600
        }