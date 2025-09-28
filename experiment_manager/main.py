#!/usr/bin/env python3
"""
Experiment Manager Service - БЛОК 3
Виртуальная торговая площадка для тестирования стратегии
"""
import psycopg2
import psycopg2.extras
import signal
import sys
import logging
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, List

# Setup database logging FIRST, before any other logging
try:
    from shared_logging import setup_database_logging
    setup_database_logging("experiment_manager")
except Exception as e:
    print(f"Could not setup database logging: {e}")

from config import Config
from market_data import MarketDataProvider
from portfolio import PortfolioManager

logger = logging.getLogger(__name__)

class ExperimentManagerService:
    def __init__(self):
        self.config = Config()
        self.config.validate()

        # Инициализация компонентов
        self.market_data = MarketDataProvider(self.config.ALPHA_VANTAGE_API_KEY)
        self.portfolio = PortfolioManager(self.config, self.market_data)

        # Подключение к БД для уведомлений
        self.conn = None
        self.connect_db()

        # Статистика
        self.stats = {
            'signals_processed': 0,
            'positions_opened': 0,
            'positions_closed': 0,
            'total_pnl': 0,
            'start_time': datetime.now(),
            'last_monitoring_check': None,
            'last_portfolio_snapshot': None
        }

        # Флаги для контроля потоков
        self.running = True
        self.monitoring_thread = None

        # Обработка сигналов завершения
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)

    def connect_db(self):
        """Подключение к PostgreSQL для уведомлений"""
        try:
            self.conn = psycopg2.connect(self.config.DATABASE_URL)
            self.conn.autocommit = True
            logger.info("Notification database connected")
        except Exception as e:
            logger.error(f"Notification database connection failed: {e}")
            raise

    def shutdown(self, signum, frame):
        """Graceful shutdown"""
        logger.info("Shutting down Experiment Manager (SIGINT received)")
        self.running = False

        # Ждем завершения мониторинга
        if self.monitoring_thread and self.monitoring_thread.is_alive():
            self.monitoring_thread.join(timeout=5)

        # Финальная статистика
        portfolio = self.portfolio.get_portfolio_status()
        logger.info(f"Final portfolio: ${portfolio['total_value']:.2f} ({portfolio['total_return']:+.2f}%)")
        logger.info(f"Total positions: {self.stats['positions_opened']} opened, {self.stats['positions_closed']} closed")

        if self.conn:
            self.conn.close()
        sys.exit(0)

    def listen_for_signals(self):
        """Слушает уведомления о новых сигналах"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("LISTEN new_trading_signals;")
            logger.info("Listening for notifications on channel 'new_trading_signals'")

            while self.running:
                # Проверяем уведомления каждые 0.1 секунды
                if self.conn.poll() is None:
                    time.sleep(0.1)
                    continue

                while self.conn.notifies:
                    notify = self.conn.notifies.pop(0)
                    signal_id = notify.payload

                    logger.info(f"Received notification: new_trading_signal ({signal_id})")
                    self.process_signal(signal_id)

        except Exception as e:
            logger.error(f"Error in signal listener: {e}")
            if self.running:
                # Переподключаемся и продолжаем
                time.sleep(5)
                self.connect_db()
                self.listen_for_signals()

    def process_signal(self, signal_id: str):
        """Обрабатывает новый сигнал"""
        try:
            # Загружаем данные сигнала
            signal_data = self.load_signal_data(signal_id)
            if not signal_data:
                logger.warning(f"Signal {signal_id} not found")
                return

            logger.info(f"Processing signal: {signal_data['ticker']} {signal_data['action']}, "
                       f"wave {signal_data['wave']}, confidence {signal_data['confidence']}%")

            # Проверяем время входа
            if not self.is_entry_time_valid(signal_data):
                logger.info(f"Entry time not valid for signal {signal_id}")
                return

            # Проверяем можем ли войти в позицию
            position_size = self.calculate_position_size(signal_data)
            can_enter, reason = self.portfolio.can_enter_position(signal_id, position_size)

            if not can_enter:
                logger.warning(f"Cannot enter position: {reason}")
                return

            # Получаем реалистичную цену исполнения
            execution_data = self.market_data.calculate_realistic_execution_price(
                signal_data['ticker'], signal_data['action'], position_size
            )

            if not execution_data:
                logger.error(f"Could not get execution price for {signal_data['ticker']}")
                return

            # Входим в позицию
            experiment_id = self.portfolio.enter_position({
                'signal_id': signal_data['id'],
                'news_id': signal_data['news_id'],
                'ticker': signal_data['ticker'],
                'action': signal_data['action'],
                'confidence': signal_data['confidence']
            }, {
                'position_size': position_size,
                **execution_data
            })

            if experiment_id:
                self.stats['signals_processed'] += 1
                self.stats['positions_opened'] += 1
                logger.info(f"Position opened successfully: experiment {experiment_id}")
            else:
                logger.error(f"Failed to open position for signal {signal_id}")

        except Exception as e:
            logger.error(f"Failed to process signal {signal_id}: {e}")

    def load_signal_data(self, signal_id: str) -> Dict:
        """Загружает данные сигнала из БД"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cursor.execute("""
                SELECT s.*, n.headline
                FROM signals s
                JOIN news n ON s.news_id = n.id
                WHERE s.id = %s
            """, (signal_id,))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                'id': row['id'],
                'news_id': row['news_id'],
                'ticker': row['ticker'],
                'action': row['action'],
                'wave': row['wave'],
                'entry_start': row['entry_start'],
                'entry_optimal': row['entry_optimal'],
                'entry_end': row['entry_end'],
                'expected_move': row['expected_move_percent'],
                'confidence': row['confidence'],
                'headline': row['headline']
            }

        except Exception as e:
            logger.error(f"Failed to load signal {signal_id}: {e}")
            return None

    def is_entry_time_valid(self, signal_data: Dict) -> bool:
        """Проверяет корректность времени входа"""
        now = datetime.now(timezone.utc)

        # Проверяем окно входа
        if now < signal_data['entry_start']:
            logger.debug(f"Too early for entry: {now} < {signal_data['entry_start']}")
            return False

        if now > signal_data['entry_end']:
            logger.debug(f"Too late for entry: {now} > {signal_data['entry_end']}")
            return False

        return True

    def calculate_position_size(self, signal_data: Dict) -> float:
        """Рассчитывает размер позиции"""
        portfolio = self.portfolio.get_portfolio_status()

        # Базовый расчет с учетом confidence
        position_size = self.config.calculate_position_size(
            portfolio['total_value'],
            signal_data['confidence']
        )

        # Применяем лимиты
        max_position = portfolio['total_value'] * (self.config.MAX_POSITION_PERCENT / 100)
        min_position = self.config.MIN_POSITION_SIZE

        position_size = max(min_position, min(position_size, max_position))

        # Учитываем доступный кеш
        available_cash = portfolio['available_cash']
        reserve = portfolio['total_value'] * (self.config.MIN_CASH_RESERVE_PERCENT / 100)
        max_available = available_cash - reserve

        position_size = min(position_size, max_available)

        logger.debug(f"Position sizing: base ${position_size:.2f}, "
                    f"confidence boost for {signal_data['confidence']}%")

        return position_size

    def monitor_positions(self):
        """Мониторит активные позиции каждые 30 секунд"""
        logger.info("Starting position monitoring thread")

        while self.running:
            try:
                self.stats['last_monitoring_check'] = datetime.now()

                # Проверяем дневной лимит потерь
                if self.portfolio.check_daily_loss_limit():
                    logger.warning("Daily loss limit exceeded - closing all positions")
                    self.close_all_positions("daily_loss_limit")
                    time.sleep(self.config.POSITION_CHECK_INTERVAL_SECONDS)
                    continue

                # Получаем активные позиции
                active_positions = self.get_active_positions()

                for position in active_positions:
                    self.check_position_exit_conditions(position)

                # Проверяем позиции с превышением времени
                risk_positions = self.portfolio.get_positions_at_risk()
                for risk_pos in risk_positions:
                    logger.warning(f"Closing position {risk_pos['ticker']} due to {risk_pos['risk_reason']}")
                    self.portfolio.exit_position(risk_pos['experiment_id'], risk_pos['risk_reason'])
                    self.stats['positions_closed'] += 1

                time.sleep(self.config.POSITION_CHECK_INTERVAL_SECONDS)

            except Exception as e:
                logger.error(f"Error in position monitoring: {e}")
                time.sleep(self.config.POSITION_CHECK_INTERVAL_SECONDS)

    def get_active_positions(self) -> List[Dict]:
        """Получает список активных позиций"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # Проверяем что таблица exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'experiments'
                )
            """)
            if not cursor.fetchone()[0]:
                logger.debug("No experiments table found, returning empty list")
                return []

            cursor.execute("""
                SELECT *
                FROM experiments
                WHERE status = 'active'
                ORDER BY created_at
            """)
            results = cursor.fetchall()
            return results if results else []

        except Exception as e:
            logger.error(f"Failed to get active positions: {e}")
            return []

    def check_position_exit_conditions(self, position):
        """Проверяет условия выхода для позиции"""
        try:
            current_price = self.market_data.get_current_price(position['ticker'])
            if not current_price:
                logger.warning(f"Could not get current price for {position['ticker']}")
                return

            # Рассчитываем текущую P&L
            current_value = position['shares'] * current_price
            unrealized_pnl = current_value - position['position_size']
            unrealized_percent = float(unrealized_pnl / position['position_size']) * 100

            logger.debug(f"Position update: {position['ticker']}")
            logger.debug(f"  Current price: ${current_price:.2f}")
            logger.debug(f"  Unrealized P&L: ${unrealized_pnl:+.2f} ({unrealized_percent:+.2f}%)")

            # Проверяем stop loss
            if current_price <= position['stop_loss_price']:
                logger.info(f"Stop loss hit for {position['ticker']}: "
                           f"${current_price:.2f} <= ${position['stop_loss_price']:.2f}")
                self.portfolio.exit_position(position['id'], 'stop_loss', current_price)
                self.stats['positions_closed'] += 1
                return

            # Проверяем take profit
            if current_price >= position['take_profit_price']:
                logger.info(f"Take profit hit for {position['ticker']}: "
                           f"${current_price:.2f} >= ${position['take_profit_price']:.2f}")
                self.portfolio.exit_position(position['id'], 'take_profit', current_price)
                self.stats['positions_closed'] += 1
                return

            # Trailing stop logic (если активирован)
            if unrealized_percent >= self.config.TRAILING_STOP_ACTIVATION_PERCENT:
                new_stop = current_price * (1 - self.config.TRAILING_STOP_DISTANCE_PERCENT / 100)
                if new_stop > position['stop_loss_price']:
                    # Обновляем trailing stop
                    cursor = self.conn.cursor()
                    cursor.execute("""
                        UPDATE experiments SET stop_loss_price = %s WHERE id = %s
                    """, (new_stop, position['id']))
                    logger.info(f"Updated trailing stop for {position['ticker']}: ${new_stop:.2f}")

        except Exception as e:
            logger.error(f"Error checking exit conditions for position {position['id']}: {e}")

    def close_all_positions(self, reason: str):
        """Закрывает все активные позиции"""
        try:
            active_positions = self.get_active_positions()
            logger.warning(f"Closing {len(active_positions)} positions due to: {reason}")

            for position in active_positions:
                self.portfolio.exit_position(position['id'], reason)
                self.stats['positions_closed'] += 1

        except Exception as e:
            logger.error(f"Error closing all positions: {e}")

    def create_portfolio_snapshots(self):
        """Создает снимки портфеля каждые 5 минут"""
        while self.running:
            try:
                self.portfolio.create_snapshot()
                self.stats['last_portfolio_snapshot'] = datetime.now()
                time.sleep(self.config.PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS)

            except Exception as e:
                logger.error(f"Error creating portfolio snapshot: {e}")
                time.sleep(self.config.PORTFOLIO_SNAPSHOT_INTERVAL_SECONDS)

    def log_hourly_stats(self):
        """Логирует часовую статистику"""
        portfolio = self.portfolio.get_portfolio_status()
        uptime = datetime.now() - self.stats['start_time']
        uptime_str = str(uptime).split('.')[0]

        logger.info("📊 Portfolio Statistics:")
        logger.info(f"  Total value: ${portfolio['total_value']:.2f} ({portfolio['total_return']:+.2f}%)")
        logger.info(f"  Cash: ${portfolio['cash_balance']:.2f} ({portfolio['cash_balance']/portfolio['total_value']*100:.1f}%)")
        logger.info(f"  Positions: {portfolio['positions_count']} active")
        logger.info(f"  Today's P&L: ${portfolio['realized_pnl_today']:+.2f}")
        logger.info(f"  Unrealized P&L: ${portfolio['unrealized_pnl']:+.2f}")

        # Статистика сделок
        logger.info(f"  Signals processed: {self.stats['signals_processed']}")
        logger.info(f"  Positions opened: {self.stats['positions_opened']}")
        logger.info(f"  Positions closed: {self.stats['positions_closed']}")
        logger.info(f"  Uptime: {uptime_str}")

        # Статистика кеша цен
        cache_stats = self.market_data.get_cache_stats()
        logger.info(f"  Price cache: {cache_stats['valid_entries']}/{cache_stats['total_entries']} valid")

    def run(self):
        """Основной цикл"""
        logger.info("Starting Experiment Manager")
        logger.info(f"Config: capital=${self.config.INITIAL_CAPITAL}, "
                   f"max_positions={self.config.MAX_CONCURRENT_POSITIONS}, "
                   f"daily_limit={self.config.DAILY_LOSS_LIMIT_PERCENT}%")

        # Показываем текущий статус портфеля
        portfolio = self.portfolio.get_portfolio_status()
        logger.info(f"Portfolio status: ${portfolio['total_value']:.2f}, "
                   f"{portfolio['positions_count']} positions")

        # Запускаем поток мониторинга позиций
        self.monitoring_thread = threading.Thread(target=self.monitor_positions, daemon=True)
        self.monitoring_thread.start()

        # Запускаем поток создания снимков портфеля
        snapshot_thread = threading.Thread(target=self.create_portfolio_snapshots, daemon=True)
        snapshot_thread.start()

        last_hourly_log = datetime.now()

        try:
            while True:
                # Логируем статистику каждый час
                if datetime.now() - last_hourly_log >= timedelta(hours=1):
                    self.log_hourly_stats()
                    last_hourly_log = datetime.now()

                # Слушаем уведомления (блокирующий вызов)
                self.listen_for_signals()

        except KeyboardInterrupt:
            logger.info("Service stopped by user")
        except Exception as e:
            logger.error(f"Service error: {e}")

if __name__ == "__main__":
    service = ExperimentManagerService()
    service.run()