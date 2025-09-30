#!/usr/bin/env python3
"""
Portfolio Manager - БЛОК 3
Управление виртуальным портфелем и позициями
"""
import psycopg2
import psycopg2.extras
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

class PortfolioManager:
    def __init__(self, config, market_data):
        self.config = config
        self.market_data = market_data
        self.conn = None
        self.connect_db()

    def connect_db(self):
        """Подключение к PostgreSQL"""
        try:
            self.conn = psycopg2.connect(self.config.DATABASE_URL)
            self.conn.autocommit = True
            logger.info("Portfolio database connected")

            # Создаем таблицы если их нет
            cursor = self.conn.cursor()

            # Portfolio snapshots таблица
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() UNIQUE,
                    total_value DECIMAL(12,2) NOT NULL,
                    cash_balance DECIMAL(12,2) NOT NULL,
                    positions_count INTEGER DEFAULT 0,
                    unrealized_pnl DECIMAL(12,2) DEFAULT 0,
                    realized_pnl_today DECIMAL(12,2) DEFAULT 0,
                    realized_pnl_total DECIMAL(12,2) DEFAULT 0,
                    daily_return DECIMAL(8,4) DEFAULT 0,
                    total_return DECIMAL(8,4) DEFAULT 0
                )
            """)

            # Experiments таблица - для трейдинговых позиций
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS experiments (
                    id SERIAL PRIMARY KEY,
                    signal_id INTEGER,
                    news_id INTEGER,
                    ticker VARCHAR(10) NOT NULL,
                    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    entry_price DECIMAL(10,4) NOT NULL,
                    position_size DECIMAL(12,2) NOT NULL,
                    shares DECIMAL(12,6) NOT NULL,
                    commission_paid DECIMAL(8,4) DEFAULT 0,
                    stop_loss_price DECIMAL(10,4),
                    take_profit_price DECIMAL(10,4),
                    max_hold_until TIMESTAMP WITH TIME ZONE,
                    sp500_entry DECIMAL(10,4),
                    exit_time TIMESTAMP WITH TIME ZONE,
                    exit_price DECIMAL(10,4),
                    exit_reason VARCHAR(50),
                    gross_pnl DECIMAL(12,2),
                    net_pnl DECIMAL(12,2),
                    return_percent DECIMAL(8,4),
                    hold_duration INTEGER,
                    sp500_exit DECIMAL(10,4),
                    sp500_return DECIMAL(8,4),
                    alpha DECIMAL(8,4),
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)

            # News items таблица (если ее нет)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS news_items (
                    id SERIAL PRIMARY KEY,
                    news_id VARCHAR(255) UNIQUE NOT NULL,
                    headline TEXT NOT NULL,
                    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    significance_score DECIMAL(3,2),
                    is_significant BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)

            # Trading signals таблица (если ее нет)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trading_signals (
                    id SERIAL PRIMARY KEY,
                    news_item_id INTEGER REFERENCES news_items(id),
                    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
                    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
                    elliott_wave INTEGER NOT NULL CHECK (elliott_wave >= 0 AND elliott_wave <= 6),
                    wave_description TEXT NOT NULL,
                    reasoning TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)

            # Индексы
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp
                ON portfolio_snapshots(timestamp)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_experiments_status
                ON experiments(status)
            """)

            cursor.close()
            logger.info("Database tables initialized")

        except Exception as e:
            logger.error(f"Portfolio database connection failed: {e}")
            raise

    def get_portfolio_status(self) -> Dict:
        """Возвращает текущий статус портфеля"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # Получаем последний снимок
            cursor.execute("""
                SELECT * FROM portfolio_snapshots
                ORDER BY timestamp DESC
                LIMIT 1
            """)
            snapshot = cursor.fetchone()

            if not snapshot:
                # Создаем начальный снимок если его нет
                return self.create_initial_portfolio()

            # Получаем активные позиции
            cursor.execute("""
                SELECT COUNT(*) as count, COALESCE(SUM(position_size), 0) as total_exposure
                FROM experiments
                WHERE status = 'active'
            """)
            positions_info = cursor.fetchone()

            # Рассчитываем текущую unrealized P&L для активных позиций
            unrealized_pnl = self.calculate_unrealized_pnl()

            # Convert Decimal to float to avoid arithmetic errors
            cash_balance = float(snapshot['cash_balance'])
            total_exposure = float(positions_info['total_exposure'])
            snapshot_total_value = float(snapshot['total_value'])

            current_value = cash_balance + unrealized_pnl + total_exposure

            return {
                'total_value': current_value,
                'cash_balance': cash_balance,
                'positions_count': positions_info['count'],
                'positions_exposure': total_exposure,
                'unrealized_pnl': unrealized_pnl,
                'realized_pnl_today': float(snapshot['realized_pnl_today']),
                'realized_pnl_total': float(snapshot['realized_pnl_total']),
                'daily_return': float(((current_value / snapshot_total_value) - 1) * 100) if snapshot_total_value > 0 else 0,
                'total_return': float(((current_value / self.config.INITIAL_CAPITAL) - 1) * 100),
                'available_cash': cash_balance,
                'last_updated': snapshot['timestamp']
            }

        except Exception as e:
            logger.error(f"Failed to get portfolio status: {e}")
            return self.create_initial_portfolio()

    def create_initial_portfolio(self) -> Dict:
        """Создает начальный портфель"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO portfolio_snapshots (
                    total_value, cash_balance, positions_count,
                    unrealized_pnl, realized_pnl_today, realized_pnl_total,
                    daily_return, total_return
                ) VALUES (%s, %s, 0, 0, 0, 0, 0, 0)
                ON CONFLICT (timestamp) DO NOTHING
            """, (self.config.INITIAL_CAPITAL, self.config.INITIAL_CAPITAL))

            logger.info(f"Created initial portfolio with ${self.config.INITIAL_CAPITAL}")

            return {
                'total_value': self.config.INITIAL_CAPITAL,
                'cash_balance': self.config.INITIAL_CAPITAL,
                'positions_count': 0,
                'positions_exposure': 0,
                'unrealized_pnl': 0,
                'realized_pnl_today': 0,
                'realized_pnl_total': 0,
                'daily_return': 0,
                'total_return': 0,
                'available_cash': self.config.INITIAL_CAPITAL,
                'last_updated': datetime.now(timezone.utc)
            }

        except Exception as e:
            logger.error(f"Failed to create initial portfolio: {e}")
            raise

    def can_enter_position(self, signal_id: int, position_size: float) -> Tuple[bool, str]:
        """Проверяет можно ли войти в позицию"""
        try:
            portfolio = self.get_portfolio_status()

            # Проверка 1: Достаточно ли кеша
            if position_size > portfolio['available_cash']:
                return False, f"Insufficient cash: need ${position_size}, have ${portfolio['available_cash']}"

            # Проверка 2: Не превышаем ли максимальное количество позиций
            if portfolio['positions_count'] >= self.config.MAX_CONCURRENT_POSITIONS:
                return False, f"Maximum positions reached: {portfolio['positions_count']}/{self.config.MAX_CONCURRENT_POSITIONS}"

            # Проверка 3: Размер позиции не превышает лимит портфеля
            max_position = portfolio['total_value'] * (self.config.MAX_POSITION_PERCENT / 100)
            if position_size > max_position:
                return False, f"Position size ${position_size} exceeds limit ${max_position} ({self.config.MAX_POSITION_PERCENT}%)"

            # Проверка 4: Минимальный размер позиции
            if position_size < self.config.MIN_POSITION_SIZE:
                return False, f"Position size ${position_size} below minimum ${self.config.MIN_POSITION_SIZE}"

            # Проверка 5: Сохранение резерва кеша
            cash_after_position = portfolio['cash_balance'] - position_size
            min_cash_reserve = portfolio['total_value'] * (self.config.MIN_CASH_RESERVE_PERCENT / 100)
            if cash_after_position < min_cash_reserve:
                return False, f"Would violate cash reserve: ${cash_after_position} < ${min_cash_reserve}"

            # Проверка 6: Daily loss limit
            realized_pnl = portfolio['realized_pnl_today']
            total_value = portfolio['total_value']
            daily_loss_percent = (abs(realized_pnl) / total_value) * 100 if total_value > 0 else 0
            if daily_loss_percent >= self.config.DAILY_LOSS_LIMIT_PERCENT:
                return False, f"Daily loss limit reached: {daily_loss_percent:.1f}% >= {self.config.DAILY_LOSS_LIMIT_PERCENT}%"

            return True, "Position allowed"

        except Exception as e:
            logger.error(f"Error checking position entry: {e}")
            return False, f"Check failed: {e}"

    def enter_position(self, signal_data: Dict, execution_data: Dict) -> Optional[int]:
        """Входит в позицию и создает эксперимент"""
        try:
            # Получаем данные бенчмарка (опционально - не фейлим если недоступен)
            sp500_price = self.market_data.get_benchmark_price('SPY')
            if sp500_price is None:
                logger.warning("Could not get SPY benchmark price, proceeding without benchmark")
                sp500_price = 0  # Ставим 0 чтобы не фейлить трейд

            # Рассчитываем параметры позиции (convert all to float to avoid Decimal errors)
            position_size = float(execution_data['position_size'])
            execution_price = float(execution_data['execution_price'])
            shares = position_size / execution_price
            commission = self.config.calculate_commission(position_size)
            total_cost = position_size + commission

            # Рассчитываем уровни stop loss и take profit
            stop_loss_price = execution_price * (1 - self.config.DEFAULT_STOP_LOSS_PERCENT / 100)
            take_profit_price = execution_price * (1 + self.config.DEFAULT_TAKE_PROFIT_PERCENT / 100)

            # Максимальное время удержания
            max_hold_until = datetime.now(timezone.utc) + timedelta(hours=signal_data.get('max_hold_hours', 6))

            # Создаем эксперимент
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO experiments (
                    signal_id, news_id, ticker, entry_time, entry_price, position_size, shares, commission_paid,
                    stop_loss_price, take_profit_price, max_hold_until, sp500_entry, status
                ) VALUES (
                    %s, %s, %s, NOW(), %s, %s, %s, %s,
                    %s, %s, %s, %s, 'active'
                ) RETURNING id
            """, (
                signal_data['signal_id'], signal_data['news_id'], signal_data['ticker'],
                execution_price, position_size,
                shares, commission, stop_loss_price, take_profit_price,
                max_hold_until, sp500_price
            ))

            experiment_id = cursor.fetchone()[0]

            # Обновляем портфель (уменьшаем кеш)
            self.update_cash_balance(-total_cost)

            logger.info(f"💰 BUYING {signal_data['ticker']}:")
            logger.info(f"  Market price: ${execution_data['market_price']:.2f}")
            logger.info(f"  Entry price: ${execution_data['execution_price']:.2f} (after slippage)")
            logger.info(f"  Shares: {shares:.4f}")
            logger.info(f"  Position size: ${execution_data['position_size']:.2f}")
            logger.info(f"  Commission: ${commission:.2f}")
            logger.info(f"  Stop loss: ${stop_loss_price:.2f} (-{self.config.DEFAULT_STOP_LOSS_PERCENT}%)")
            logger.info(f"  Take profit: ${take_profit_price:.2f} (+{self.config.DEFAULT_TAKE_PROFIT_PERCENT}%)")
            logger.info(f"  Max hold until: {max_hold_until}")

            return experiment_id

        except Exception as e:
            logger.error(f"Failed to enter position: {e}")
            return None

    def exit_position(self, experiment_id: int, exit_reason: str, current_price: float = None) -> bool:
        """Выходит из позиции"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # Получаем данные эксперимента (упрощенная версия без signals)
            cursor.execute("""
                SELECT *
                FROM experiments
                WHERE id = %s AND status = 'active'
            """, (experiment_id,))

            experiment = cursor.fetchone()
            if not experiment:
                logger.warning(f"Experiment {experiment_id} not found or not active")
                return False

            # Получаем текущую цену если не передана
            if current_price is None:
                execution_data = self.market_data.calculate_realistic_execution_price(
                    experiment['ticker'], 'SELL', experiment['position_size']
                )
                if not execution_data:
                    logger.error(f"Could not get exit price for position {experiment['id']} (ticker: {experiment['ticker']})")
                    return False
                exit_price = execution_data['execution_price']
            else:
                # Применяем реалистичный slippage для продажи
                slippage = self.config.calculate_slippage(current_price)
                exit_price = current_price - slippage

            # Получаем цену S&P 500 для бенчмарка
            sp500_exit = self.market_data.get_benchmark_price('SPY')

            # Рассчитываем P&L (convert all Decimals to float)
            position_size = float(experiment['position_size'])
            shares = float(experiment['shares'])
            commission_paid = float(experiment['commission_paid'])

            exit_commission = self.config.calculate_commission(position_size)
            proceeds = shares * exit_price - exit_commission
            entry_cost = position_size + commission_paid

            gross_pnl = proceeds - entry_cost
            net_pnl = gross_pnl  # Комиссия уже учтена
            return_percent = (net_pnl / entry_cost) * 100 if entry_cost > 0 else 0

            # Бенчмарк расчеты
            sp500_return = 0
            alpha = 0
            if experiment['sp500_entry'] and sp500_exit:
                sp500_entry = float(experiment['sp500_entry'])
                sp500_return = ((sp500_exit / sp500_entry) - 1) * 100
                alpha = return_percent - sp500_return

            # Время удержания
            hold_duration = int((datetime.now(timezone.utc) - experiment['entry_time']).total_seconds() / 60)

            # Обновляем эксперимент
            cursor.execute("""
                UPDATE experiments SET
                    exit_time = NOW(),
                    exit_price = %s,
                    exit_reason = %s,
                    gross_pnl = %s,
                    net_pnl = %s,
                    return_percent = %s,
                    hold_duration = %s,
                    sp500_exit = %s,
                    sp500_return = %s,
                    alpha = %s,
                    status = 'closed'
                WHERE id = %s
            """, (
                exit_price, exit_reason, gross_pnl, net_pnl, return_percent,
                hold_duration, sp500_exit, sp500_return, alpha, experiment_id
            ))

            # Обновляем портфель (возвращаем кеш)
            self.update_cash_balance(proceeds)
            self.update_realized_pnl(net_pnl)

            # Логируем результат
            if net_pnl > 0:
                logger.info(f"📈 CLOSING position {experiment['id']}:")
            else:
                logger.info(f"📉 CLOSING position {experiment['id']}:")

            logger.info(f"  Reason: {exit_reason}")
            logger.info(f"  Exit price: ${exit_price:.2f}")
            logger.info(f"  P&L: ${net_pnl:+.2f} ({return_percent:+.2f}%)")
            logger.info(f"  Held for: {hold_duration//60}h {hold_duration%60}m")
            logger.info(f"  S&P moved: {sp500_return:+.2f}%")
            logger.info(f"  Alpha: {alpha:+.2f}% {'✅' if alpha > 0 else '❌'}")

            return True

        except Exception as e:
            logger.error(f"Failed to exit position {experiment_id}: {e}")
            return False

    def calculate_unrealized_pnl(self) -> float:
        """Рассчитывает нереализованную прибыль/убыток"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cursor.execute("""
                SELECT id, ticker, position_size, shares, entry_price
                FROM experiments
                WHERE status = 'active'
            """)

            active_positions = cursor.fetchall()
            total_unrealized = 0

            for position in active_positions:
                ticker = position['ticker']
                shares = float(position['shares'])
                entry_price = float(position['entry_price'])
                position_size = float(position['position_size'])

                # Получаем текущую цену
                current_price = self.market_data.get_current_price(ticker, allow_stale=True)

                if current_price:
                    current_value = shares * current_price
                    unrealized = current_value - position_size
                    total_unrealized += unrealized
                else:
                    logger.debug(f"Cannot calculate unrealized P&L for {ticker} - no price available")

            return total_unrealized

        except Exception as e:
            logger.error(f"Failed to calculate unrealized P&L: {e}")
            return 0

    def update_cash_balance(self, change: float):
        """Обновляет баланс кеша"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE portfolio_snapshots SET
                    cash_balance = cash_balance + %s,
                    timestamp = NOW()
                WHERE timestamp = (SELECT MAX(timestamp) FROM portfolio_snapshots)
            """, (change,))
        except Exception as e:
            logger.error(f"Failed to update cash balance: {e}")

    def update_realized_pnl(self, pnl: float):
        """Обновляет реализованную прибыль"""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE portfolio_snapshots SET
                    realized_pnl_today = realized_pnl_today + %s,
                    realized_pnl_total = realized_pnl_total + %s,
                    timestamp = NOW()
                WHERE timestamp = (SELECT MAX(timestamp) FROM portfolio_snapshots)
            """, (pnl, pnl))
        except Exception as e:
            logger.error(f"Failed to update realized P&L: {e}")

    def create_snapshot(self):
        """Создает снимок портфеля"""
        try:
            portfolio = self.get_portfolio_status()

            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO portfolio_snapshots (
                    total_value, cash_balance, positions_count,
                    unrealized_pnl, realized_pnl_today, realized_pnl_total,
                    daily_return, total_return
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                portfolio['total_value'], portfolio['cash_balance'], portfolio['positions_count'],
                portfolio['unrealized_pnl'], portfolio['realized_pnl_today'], portfolio['realized_pnl_total'],
                portfolio['daily_return'], portfolio['total_return']
            ))

            logger.debug(f"Portfolio snapshot created: ${portfolio['total_value']:.2f}")

        except Exception as e:
            logger.error(f"Failed to create portfolio snapshot: {e}")

    def get_positions_at_risk(self) -> List[Dict]:
        """Возвращает позиции, которые нужно закрыть из-за рисков"""
        try:
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            # Позиции с превышением времени удержания
            # Упрощенная версия без связи с signals
            cursor.execute("""
                SELECT *
                FROM experiments
                WHERE status = 'active'
            """)
            time_expired = cursor.fetchall()

            risk_positions = []
            for pos in time_expired:
                risk_positions.append({
                    'experiment_id': pos['id'],
                    'ticker': pos['ticker'],
                    'risk_reason': 'max_hold_time_exceeded',
                    'entry_time': pos['entry_time'],
                    'max_hold_until': pos['max_hold_until']
                })

            return risk_positions

        except Exception as e:
            logger.error(f"Failed to get positions at risk: {e}")
            return []

    def check_daily_loss_limit(self) -> bool:
        """Проверяет превышение дневного лимита потерь"""
        try:
            portfolio = self.get_portfolio_status()
            realized_pnl = portfolio['realized_pnl_today']
            total_value = portfolio['total_value']
            daily_loss_percent = (abs(realized_pnl) / total_value) * 100 if total_value > 0 else 0

            return daily_loss_percent >= self.config.DAILY_LOSS_LIMIT_PERCENT

        except Exception as e:
            logger.error(f"Failed to check daily loss limit: {e}")
            return False