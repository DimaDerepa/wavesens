#!/usr/bin/env python3
"""
Market Timing utilities for managing trading hours
"""
from datetime import datetime, time, timedelta, timezone
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# US market hours (Eastern Time)
# Regular trading: 9:30 AM - 4:00 PM ET
# After-hours: 4:00 PM - 8:00 PM ET
# In UTC: Regular: 14:30 - 21:00, After-hours: 21:00 - 01:00 (next day)

def is_market_open(check_time: Optional[datetime] = None) -> bool:
    """
    Check if US market is currently open (including after-hours)

    Args:
        check_time: Time to check (default: now)

    Returns:
        True if market is open
    """
    if check_time is None:
        check_time = datetime.now(timezone.utc)

    # Get weekday (0=Monday, 6=Sunday)
    weekday = check_time.weekday()

    # Market closed on weekends
    if weekday >= 5:  # Saturday or Sunday
        return False

    # Get time in UTC
    current_hour = check_time.hour
    current_minute = check_time.minute
    current_time_minutes = current_hour * 60 + current_minute

    # Regular hours: 14:30 - 21:00 UTC (9:30 AM - 4:00 PM ET)
    # After-hours: 21:00 - 01:00 UTC (4:00 PM - 8:00 PM ET)
    market_open_minutes = 14 * 60 + 30  # 14:30 UTC
    market_close_minutes = 21 * 60  # 21:00 UTC
    after_hours_close_minutes = 1 * 60  # 01:00 UTC next day

    # Check if in regular or after-hours trading
    if market_open_minutes <= current_time_minutes < 24 * 60:
        # Same day (14:30 - 23:59)
        return True
    elif current_time_minutes < after_hours_close_minutes:
        # Next day (00:00 - 01:00), but need to check previous day was weekday
        prev_day = check_time - timedelta(days=1)
        if prev_day.weekday() < 5:
            return True

    return False


def get_market_close_time(reference_time: Optional[datetime] = None) -> datetime:
    """
    Get the next market close time (after-hours close at 01:00 UTC / 8:00 PM ET)

    Args:
        reference_time: Reference time (default: now)

    Returns:
        Next market close datetime
    """
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    # After-hours close: 01:00 UTC (8:00 PM ET)
    # Regular close: 21:00 UTC (4:00 PM ET)

    # Use after-hours close time for maximum holding period
    close_hour = 1
    close_minute = 0

    # If current time is before 01:00, close time is today at 01:00
    if reference_time.hour < close_hour:
        close_time = reference_time.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)
    else:
        # Otherwise, close time is tomorrow at 01:00
        next_day = reference_time + timedelta(days=1)
        close_time = next_day.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)

    # If close time falls on weekend, push to Monday
    while close_time.weekday() >= 5:
        close_time += timedelta(days=1)

    return close_time


def get_next_market_open_time(reference_time: Optional[datetime] = None) -> datetime:
    """
    Get the next market open time (9:30 AM ET / 14:30 UTC)

    Args:
        reference_time: Reference time (default: now)

    Returns:
        Next market open datetime
    """
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    open_hour = 14
    open_minute = 30

    # If current time is before 14:30, open time is today at 14:30
    if reference_time.hour < open_hour or (reference_time.hour == open_hour and reference_time.minute < open_minute):
        open_time = reference_time.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)
    else:
        # Otherwise, open time is tomorrow at 14:30
        next_day = reference_time + timedelta(days=1)
        open_time = next_day.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)

    # Skip weekends
    while open_time.weekday() >= 5:
        open_time += timedelta(days=1)

    return open_time


def calculate_adjusted_max_hold(
    entry_time: datetime,
    desired_hold_duration: timedelta,
    min_hold_duration: timedelta = timedelta(hours=2)
) -> Tuple[Optional[datetime], str]:
    """
    Calculate adjusted max_hold_until time considering market hours

    Strategy:
    1. If time until market close < min_hold_duration: Don't open position
    2. If desired max_hold extends beyond market close: Adjust to close 15 min before market close
    3. Otherwise: Use desired max_hold

    Args:
        entry_time: Position entry time
        desired_hold_duration: Desired holding period (e.g., 6 hours)
        min_hold_duration: Minimum required hold time (default: 2 hours)

    Returns:
        Tuple of (adjusted_max_hold_time, reason) or (None, reason) if should not open
    """
    market_close = get_market_close_time(entry_time)
    time_until_close = market_close - entry_time

    # Safety buffer: close 15 minutes before market close
    safe_close_time = market_close - timedelta(minutes=15)

    # Check 1: Not enough time before market close
    if time_until_close < min_hold_duration:
        reason = f"Only {time_until_close} until market close, minimum {min_hold_duration} required"
        logger.info(f"Position opening rejected: {reason}")
        return None, reason

    # Calculate desired max_hold
    desired_max_hold = entry_time + desired_hold_duration

    # Check 2: Desired hold extends beyond market close
    if desired_max_hold > safe_close_time:
        # Adjust to safe close time
        adjusted_hold = safe_close_time
        reason = f"Adjusted from {desired_hold_duration} to close before market (at {adjusted_hold.strftime('%H:%M UTC')})"
        logger.info(f"Position hold time adjusted: {reason}")
        return adjusted_hold, reason

    # Check 3: Desired hold is within market hours
    reason = f"Using desired hold duration of {desired_hold_duration}"
    return desired_max_hold, reason


def get_time_until_market_close(reference_time: Optional[datetime] = None) -> timedelta:
    """Get time remaining until market close"""
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    close_time = get_market_close_time(reference_time)
    return close_time - reference_time


def get_market_status_message() -> str:
    """Get human-readable market status message"""
    now = datetime.now(timezone.utc)

    if is_market_open(now):
        time_until_close = get_time_until_market_close(now)
        hours = int(time_until_close.total_seconds() // 3600)
        minutes = int((time_until_close.total_seconds() % 3600) // 60)
        return f"Market Open (closes in {hours}h {minutes}m)"
    else:
        next_open = get_next_market_open_time(now)
        time_until_open = next_open - now
        hours = int(time_until_open.total_seconds() // 3600)
        minutes = int((time_until_open.total_seconds() % 3600) // 60)
        return f"Market Closed (opens in {hours}h {minutes}m)"
