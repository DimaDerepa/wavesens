#!/usr/bin/env python3
"""
Signal Extractor Service - БЛОК 2
"""
import psycopg2
import psycopg2.extras
import signal
import sys
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

from config import Config
from market_status import MarketDetector, MarketStatus
from wave_analyzer import WaveAnalyzer
from ticker_validator import TickerValidator

logger = logging.getLogger(__name__)

class SignalExtractorService:
    def __init__(self):
        self.config = Config()
        self.config.validate()

        # Инициализация компонентов
        self.market_detector = MarketDetector()
        self.wave_analyzer = WaveAnalyzer(
            self.config.OPENROUTER_API_KEY,
            self.config.LLM_MODEL,
            self.config.LLM_TEMPERATURE,
            self.config.LLM_MAX_TOKENS,
            self.config.LLM_TIMEOUT_SECONDS
        )
        self.ticker_validator = TickerValidator()

        # Подключение к БД
        self.conn = None
        self.connect_db()

        # Статистика
        self.stats = {
            'news_processed': 0,
            'signals_generated': 0,
            'llm_calls': 0,
            'errors': 0,
            'start_time': datetime.now(),
            'wave_distribution': {}
        }

        # Обработка сигналов завершения
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)

    def connect_db(self):
        """Подключение к PostgreSQL"""
        try:
            self.conn = psycopg2.connect(self.config.DATABASE_URL)
            self.conn.autocommit = True
            logger.info("Database connected")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def shutdown(self, signum, frame):
        """Graceful shutdown"""
        logger.info("Shutting down Signal Extractor (SIGINT received)")
        logger.info(f"Final stats: processed {self.stats['news_processed']} news, "
                   f"generated {self.stats['signals_generated']} signals")
        if self.conn:
            self.conn.close()
        sys.exit(0)

    def listen_for_notifications(self):
        """Слушает уведомления от PostgreSQL"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("LISTEN new_significant_news;")
            logger.info("Listening for notifications on channel 'new_significant_news'")

            while True:
                # Ожидаем уведомления (блокирующий вызов)
                self.conn.poll()

                while self.conn.notifies:
                    notify = self.conn.notifies.pop(0)
                    news_id = notify.payload

                    logger.info(f"Received notification: new_significant_news ({news_id})")
                    self.process_news(news_id)

        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Error in notification listener: {e}")
            self.stats['errors'] += 1
            # Переподключаемся и продолжаем
            time.sleep(5)
            self.connect_db()
            self.listen_for_notifications()

    def process_news(self, news_id: str):
        """Обрабатывает одну новость"""
        start_time = time.time()

        try:
            # Загружаем данные новости
            news_data = self.load_news_data(news_id)
            if not news_data:
                logger.warning(f"News {news_id} not found or already processed")
                return

            logger.info(f"Processing news: {news_data['headline'][:50]}...")
            logger.info(f"News age: {news_data['age_minutes']} minutes")

            # Определяем статус рынка
            market_status = self.market_detector.get_current_status()
            logger.info(f"Market status: {market_status.value}")

            # Анализируем статус волн
            wave_status = self.config.get_wave_info(news_data['age_minutes'])
            self.log_wave_status(wave_status)

            # Проверяем волновые задержки
            delay_info = self.market_detector.get_wave_delay_info(
                news_data['age_minutes'], market_status
            )

            if delay_info['delayed']:
                logger.info(f"Waves delayed: {delay_info['reason']}")
                logger.info(f"Next opportunity: {delay_info['next_opportunity']}")
                self.mark_news_skipped(news_id, delay_info['reason'])
                return

            # Анализ волн через LLM
            logger.info("Analyzing waves with LLM...")
            wave_analysis = self.wave_analyzer.analyze_waves(
                news_data, wave_status, market_status.value
            )
            self.stats['llm_calls'] += 1

            logger.info(f"Wave analysis complete:")
            logger.info(f"  Optimal wave: {wave_analysis['optimal_wave']}")
            logger.info(f"  News type: {wave_analysis['news_type']}")
            logger.info(f"  Reasoning: {wave_analysis['wave_reasoning'][:100]}...")

            # Генерация сигналов
            logger.info(f"Generating signals for wave {wave_analysis['optimal_wave']}...")
            signals = self.wave_analyzer.generate_signals(news_data, wave_analysis)
            self.stats['llm_calls'] += 1

            if not signals:
                logger.warning("No signals generated")
                self.mark_news_processed(news_id, "No signals generated")
                return

            # Валидация и фильтрация сигналов
            valid_signals = self.validate_and_filter_signals(signals)

            if not valid_signals:
                logger.warning("All signals filtered out")
                self.mark_news_processed(news_id, "All signals filtered")
                return

            # Сохранение сигналов
            saved_count = self.save_signals(news_id, valid_signals, wave_analysis)

            # Обновляем статистику
            self.stats['news_processed'] += 1
            self.stats['signals_generated'] += saved_count

            wave = wave_analysis['optimal_wave']
            self.stats['wave_distribution'][wave] = self.stats['wave_distribution'].get(wave, 0) + saved_count

            processing_time = time.time() - start_time
            logger.info(f"News processed successfully: {saved_count} signals saved in {processing_time:.1f}s")

            # Отмечаем новость как обработанную
            self.mark_news_processed(news_id)

        except Exception as e:
            logger.error(f"Failed to process news {news_id}: {e}")
            self.stats['errors'] += 1
            self.mark_news_skipped(news_id, f"Processing error: {str(e)}")

    def load_news_data(self, news_id: str) -> Dict:
        """Загружает данные новости из БД"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cursor.execute("""
                SELECT id, headline, summary, published_at, significance_score, reasoning, processed_by_block2
                FROM news
                WHERE id = %s AND is_significant = TRUE
            """, (news_id,))

            row = cursor.fetchone()
            if not row:
                return None

            if row['processed_by_block2']:
                logger.debug(f"News {news_id} already processed")
                return None

            # Вычисляем возраст новости
            now = datetime.now(timezone.utc)
            published_at = row['published_at']
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)

            age_minutes = (now - published_at).total_seconds() / 60

            return {
                'id': row['id'],
                'headline': row['headline'],
                'summary': row['summary'] or '',
                'published_at': published_at,
                'age_minutes': int(age_minutes),
                'significance_score': row['significance_score'],
                'significance_reasoning': row['reasoning']
            }

        except Exception as e:
            logger.error(f"Failed to load news {news_id}: {e}")
            return None

    def validate_and_filter_signals(self, signals: List[Dict]) -> List[Dict]:
        """Валидирует и фильтрует сигналы"""
        valid_signals = []

        for signal in signals:
            # Проверяем минимальное движение
            if signal['expected_move'] < self.config.MIN_EXPECTED_MOVE_PERCENT:
                logger.debug(f"Signal filtered: {signal['ticker']} move too small "
                           f"({signal['expected_move']}% < {self.config.MIN_EXPECTED_MOVE_PERCENT}%)")
                continue

            # Проверяем минимальную уверенность
            if signal['confidence'] < self.config.MIN_CONFIDENCE:
                logger.debug(f"Signal filtered: {signal['ticker']} confidence too low "
                           f"({signal['confidence']}% < {self.config.MIN_CONFIDENCE}%)")
                continue

            # Валидируем тикер
            validation = self.ticker_validator.validate_ticker(signal['ticker'])
            signal['ticker_validated'] = True
            signal['ticker_exists'] = validation['exists']

            if not validation['exists']:
                logger.warning(f"Invalid ticker filtered: {signal['ticker']}")
                continue

            valid_signals.append(signal)

        logger.info(f"Validation complete: {len(valid_signals)}/{len(signals)} signals valid")
        return valid_signals

    def save_signals(self, news_id: str, signals: List[Dict], wave_analysis: Dict) -> int:
        """Сохраняет сигналы в БД"""
        try:
            cursor = self.conn.cursor()
            saved_count = 0

            for signal in signals:
                # Рассчитываем временные окна
                now = datetime.now(timezone.utc)
                wave = wave_analysis['optimal_wave']
                wave_timing = self._calculate_entry_timing(wave)

                cursor.execute("""
                    INSERT INTO signals (
                        news_id, ticker, action, wave,
                        entry_start, entry_optimal, entry_end,
                        expected_move_percent, confidence,
                        stop_loss_percent, take_profit_percent, max_hold_hours,
                        is_optimal_wave, reasoning,
                        ticker_validated, ticker_exists
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s
                    )
                """, (
                    news_id, signal['ticker'], signal['action'], wave,
                    wave_timing['entry_start'], wave_timing['entry_optimal'], wave_timing['entry_end'],
                    signal['expected_move'], signal['confidence'],
                    self.config.DEFAULT_STOP_LOSS_PERCENT,
                    self.config.DEFAULT_TAKE_PROFIT_PERCENT,
                    self.config.DEFAULT_MAX_HOLD_HOURS,
                    True,  # is_optimal_wave
                    signal['reasoning'],
                    signal['ticker_validated'], signal['ticker_exists']
                ))
                saved_count += 1

            logger.info(f"Saved {saved_count} signals to database")
            return saved_count

        except Exception as e:
            logger.error(f"Failed to save signals: {e}")
            return 0

    def mark_news_processed(self, news_id: str, skip_reason: str = None):
        """Отмечает новость как обработанную"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE news
                SET processed_by_block2 = TRUE,
                    block2_processed_at = NOW(),
                    block2_skip_reason = %s
                WHERE id = %s
            """, (skip_reason, news_id))

        except Exception as e:
            logger.error(f"Failed to mark news {news_id} as processed: {e}")

    def mark_news_skipped(self, news_id: str, reason: str):
        """Отмечает новость как пропущенную"""
        self.mark_news_processed(news_id, reason)
        logger.info(f"News {news_id} skipped: {reason}")

    def log_wave_status(self, wave_status: Dict):
        """Логирует статус волн"""
        logger.info("Wave status:")
        for wave, info in wave_status.items():
            status_msg = f"  Wave {wave} ({info['start_min']}-{info['end_min']} min): {info['status'].upper()}"
            if info['status'] == 'ongoing':
                status_msg += f" ({info['time_left']} min left)"
            logger.info(status_msg)

    def _calculate_entry_timing(self, wave: int) -> Dict[str, datetime]:
        """Рассчитывает временные окна для входа"""
        now = datetime.now(timezone.utc)
        wave_intervals = self.config.WAVE_INTERVALS

        start_min, end_min = wave_intervals.get(wave, (0, 1440))

        return {
            'entry_start': now + timedelta(minutes=start_min),
            'entry_optimal': now + timedelta(minutes=(start_min + end_min) / 2),
            'entry_end': now + timedelta(minutes=end_min)
        }

    def log_hourly_stats(self):
        """Логирует часовую статистику"""
        uptime = datetime.now() - self.stats['start_time']
        uptime_str = str(uptime).split('.')[0]

        logger.info("📊 Hourly stats:")
        logger.info(f"  News processed: {self.stats['news_processed']}")
        logger.info(f"  Signals generated: {self.stats['signals_generated']}")
        logger.info(f"  LLM calls: {self.stats['llm_calls']}")
        logger.info(f"  Errors: {self.stats['errors']}")
        logger.info(f"  Uptime: {uptime_str}")

        if self.stats['wave_distribution']:
            logger.info("  Wave distribution:")
            for wave, count in sorted(self.stats['wave_distribution'].items()):
                logger.info(f"    Wave {wave}: {count} signals")

        # Статистика валидатора тикеров
        cache_stats = self.ticker_validator.get_cache_stats()
        logger.info(f"  Ticker cache: {cache_stats['valid_count']} valid, "
                   f"{cache_stats['invalid_count']} invalid, "
                   f"age {cache_stats['cache_age_minutes']:.1f} min")

    def run(self):
        """Основной цикл"""
        logger.info("Starting Signal Extractor")
        logger.info(f"Config: model={self.config.LLM_MODEL}, "
                   f"min_move={self.config.MIN_EXPECTED_MOVE_PERCENT}%, "
                   f"min_confidence={self.config.MIN_CONFIDENCE}%")

        last_hourly_log = datetime.now()

        try:
            # Обрабатываем необработанные новости
            self.process_pending_news()

            # Основной цикл прослушивания
            while True:
                # Логируем статистику каждый час
                if datetime.now() - last_hourly_log >= timedelta(hours=1):
                    self.log_hourly_stats()
                    last_hourly_log = datetime.now()

                # Слушаем уведомления (блокирующий вызов)
                self.listen_for_notifications()

        except KeyboardInterrupt:
            logger.info("Service stopped by user")
        except Exception as e:
            logger.error(f"Service error: {e}")

    def process_pending_news(self):
        """Обрабатывает необработанные новости при запуске"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT id FROM news
                WHERE is_significant = TRUE
                  AND processed_by_block2 = FALSE
                ORDER BY processed_at DESC
                LIMIT 10
            """)

            pending_news = cursor.fetchall()
            if pending_news:
                logger.info(f"Found {len(pending_news)} pending news items")
                for (news_id,) in pending_news:
                    self.process_news(news_id)

        except Exception as e:
            logger.error(f"Failed to process pending news: {e}")

if __name__ == "__main__":
    service = SignalExtractorService()
    service.run()