# 🌊 WaveSens - ПОЛНЫЙ СИСТЕМНЫЙ ГАЙД

**Максимально подробная документация со всеми ключами, URL, архитектурой, экспериментами и багами**

Дата создания: 2025-10-02

---

## 📋 Содержание

1. [Общая архитектура системы](#общая-архитектура-системы)
2. [Файловая структура проекта](#файловая-структура-проекта)
3. [API ключи и переменные окружения](#api-ключи-и-переменные-окружения)
4. [Railway деплоймент](#railway-деплоймент)
5. [База данных PostgreSQL](#база-данных-postgresql)
6. [Блок 1: News Analyzer](#блок-1-news-analyzer)
7. [Блок 2: Signal Extractor](#блок-2-signal-extractor)
8. [Блок 3: Experiment Manager](#блок-3-experiment-manager)
9. [Frontend Dashboard](#frontend-dashboard)
10. [Backend API Server](#backend-api-server)
11. [История изменений и экспериментов](#история-изменений-и-экспериментов)
12. [Критические баги и их исправления](#критические-баги-и-их-исправления)
13. [Типичные ошибки и решения](#типичные-ошибки-и-решения)

---

## Общая архитектура системы

### Концепция

WaveSens - это **полностью реальная** торговая система без моков, использующая теорию волновых эффектов Эллиотта для генерации торговых сигналов на основе финансовых новостей.

### Основные компоненты

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WAVESENS ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────┘

   Internet                   Railway Cloud
      │
      │                  ┌──────────────────────────────┐
      │                  │   PostgreSQL Database        │
      │                  │   (Railway Postgres)         │
      │                  │                              │
      │                  │   Tables:                    │
      │                  │   - news_items               │
      │                  │   - trading_signals          │
      │                  │   - experiments              │
      │                  │   - portfolio_snapshots      │
      │                  │   - service_logs             │
      │                  │                              │
      │                  │   Triggers:                  │
      │                  │   - notify_new_significant_news│
      │                  │   - notify_new_signal        │
      │                  └──────────────────────────────┘
      │                           │
      │                           │ LISTEN/NOTIFY
      │                           │
      ├──────┬──────────┬─────────┴─────────┬───────────┐
      │      │          │                   │           │
      ▼      ▼          ▼                   ▼           ▼
  ┌────┐ ┌────┐    ┌────┐              ┌────┐      ┌────┐
  │Finn│ │Open│    │News│              │Sig │      │Exp │
  │hub │ │Rou │    │Ana │              │Ext │      │Mgr │
  │API │ │ter │    │lyz │   NOTIFY     │rac │      │    │
  │    │ │API │    │er  │─────────────→│tor │──────→│    │
  └────┘ └────┘    └────┘  new_sig_news└────┘ new_sig└────┘
                      │                   │              │
                      │                   │              │
                  Gets news          Analyzes       Executes
                  from Finnhub       waves with     virtual
                  Filters with       Claude AI      trades
                  Claude AI          Generates      Monitors
                                     signals        positions
                                                         │
                                                         │
                                                         ▼
                                                    ┌────────┐
                                                    │Yahoo   │
                                                    │Finance │
                                                    │API     │
                                                    └────────┘
                           │
                           │ WebSocket + REST API
                           │
                           ▼
                  ┌────────────────┐
                  │   Frontend     │
                  │   Dashboard    │
                  │   (React)      │
                  └────────────────┘
                           │
                           │
                      User Browser
```

### Event-Driven Flow

```
1. News Analyzer (Block 1)
   ├─ Fetches news from Finnhub every 5 seconds
   ├─ Filters with Claude AI (significance 0-100)
   ├─ Saves significant news (>70) to database
   └─ Triggers PostgreSQL NOTIFY 'new_significant_news'

2. Signal Extractor (Block 2)
   ├─ LISTENS to 'new_significant_news'
   ├─ Analyzes news age and market status
   ├─ Determines optimal Elliott Wave (0-6)
   ├─ Generates BUY/SHORT signals with Claude AI
   ├─ Saves signals to database
   └─ Triggers PostgreSQL NOTIFY 'new_trading_signals'

3. Experiment Manager (Block 3)
   ├─ LISTENS to 'new_trading_signals'
   ├─ Opens virtual positions (with market timing logic)
   ├─ Monitors positions every 30 seconds
   ├─ Closes on stop_loss, take_profit, or max_hold_until
   └─ Saves closed positions to experiments table

4. Frontend Dashboard
   ├─ Fetches active positions every 5 seconds
   ├─ Shows real-time P&L with current prices
   ├─ Displays portfolio history with alpha calculation
   └─ Connects via WebSocket for instant notifications
```

### Elliott Wave Theory

Система основана на идее, что новость вызывает серию волн реакций на рынке:

| Wave | Timing | Participants | Characteristics |
|------|--------|--------------|-----------------|
| 0 | 0-5 min | HFT алгоритмы | Мгновенная реакция, высокая волатильность |
| 1 | 5-30 min | Smart money | Информированные трейдеры входят первыми |
| 2 | 30-120 min | Институционалы | Крупные позиции, менее шума |
| 3 | 2-6 часов | Informed retail | Прочитали анализ, делают выводы |
| 4 | 6-24 часа | Mass retail | Новость распространилась широко |
| 5 | 1-3 дня | Переоценка | Фундаментальный анализ начинает работать |
| 6+ | 3-7 дней | Долгосрочный эффект | Изменения в секторе/индустрии |

### Технологический стек

**Backend:**
- Python 3.11+
- FastAPI (асинхронный веб-фреймворк)
- psycopg2 (PostgreSQL адаптер с LISTEN/NOTIFY)
- DSPy (фреймворк для структурированных LLM запросов)
- yfinance, finnhub-python, alpha_vantage (market data)

**Frontend:**
- React 18 (UI библиотека)
- TypeScript (типизированный JavaScript)
- Recharts (графики и charts)
- WebSocket API (real-time updates)

**AI/ML:**
- Claude 3.7 Sonnet через OpenRouter API
- DSPy Signatures для structured outputs
- Chain of Thought reasoning

**Infrastructure:**
- Railway (PaaS для деплоя)
- PostgreSQL (managed database)
- GitHub (version control)

---

## Файловая структура проекта

### Полное дерево директорий

```
/Users/derepadmitrij/projs/wavesens/
│
├── news_analyzer/                    # БЛОК 1: Анализ новостей
│   ├── main.py                       # Entry point для Block 1
│   ├── config.py                     # Конфигурация (API keys, LLM model)
│   ├── finnhub_client.py             # Finnhub API wrapper
│   ├── news_significance_llm.py      # Claude AI для оценки значимости
│   ├── db.py                         # PostgreSQL NOTIFY trigger
│   └── requirements.txt              # Python dependencies
│
├── signal_extractor/                 # БЛОК 2: Генерация сигналов
│   ├── main.py                       # Entry point для Block 2
│   ├── config.py                     # Конфигурация (Elliott waves, LLM)
│   ├── wave_analyzer.py              # DSPy + Claude для wave analysis
│   ├── db.py                         # PostgreSQL LISTEN + NOTIFY
│   └── requirements.txt              # Python dependencies
│
├── experiment_manager/               # БЛОК 3: Управление позициями
│   ├── main.py                       # Entry point для Block 3
│   ├── config.py                     # Risk management параметры
│   ├── portfolio.py                  # Core trading logic (КРИТИЧЕСКИЙ!)
│   ├── market_data.py                # Yahoo Finance + fallbacks
│   ├── market_timing.py              # Логика открытия позиций
│   ├── db.py                         # PostgreSQL LISTEN
│   ├── migrate_experiments.py        # Database migration script
│   └── requirements.txt              # Python dependencies
│
├── backend/                          # Backend API Server
│   ├── main.py                       # FastAPI endpoints (Railway deploys THIS!)
│   └── requirements.txt
│
├── api_server/                       # Старый backend (не используется Railway)
│   ├── main.py                       # Дубликат для локальной разработки
│   └── requirements.txt
│
├── frontend/                         # React Dashboard
│   ├── public/
│   │   ├── index.html                # HTML entry point (с cache-busting)
│   │   └── manifest.json
│   ├── src/
│   │   ├── App.tsx                   # Main React component
│   │   ├── components/
│   │   │   ├── ActivePositions.tsx   # Активные позиции (5s updates)
│   │   │   ├── PortfolioHistory.tsx  # История закрытых позиций
│   │   │   ├── TradingSignals.tsx    # Сгенерированные сигналы
│   │   │   └── ServiceLogs.tsx       # Логи всех 3 блоков
│   │   ├── services/
│   │   │   ├── api.ts                # REST API client
│   │   │   └── websocket.ts          # WebSocket connection (FIX: leak)
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript interfaces
│   │   └── index.tsx                 # React entry point
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/                          # Utility scripts
│   ├── migrate_db.py                 # Database setup script
│   ├── check_positions.py            # Diagnostic tool for positions
│   └── close_expired_positions.py    # Manual position closer
│
├── docs/                             # Документация
│   ├── COMPLETE_GUIDE.md             # Английская версия (3177 lines)
│   ├── FULL_SYSTEM_GUIDE_RU.md       # Этот файл (максимально полный)
│   ├── RAILWAY_DEPLOY_GUIDE.md       # Railway deployment guide
│   ├── DEPLOYMENT.md                 # Старый deployment guide
│   └── README.md                     # Краткий README
│
├── .gitignore
├── railway.json                      # Railway monorepo configuration
└── Procfile                          # Railway process definitions

```

### Ключевые файлы с объяснениями

#### 1. `experiment_manager/portfolio.py` (1137 строк) - САМЫЙ КРИТИЧЕСКИЙ

**Назначение**: Core trading logic для виртуальных позиций

**Ключевые функции**:

```python
class Portfolio:
    def __init__(self, initial_capital=100000):
        # Начальный капитал: $100,000 виртуальный
        # market_data_provider: Yahoo Finance + Finnhub + Alpha Vantage
        # portfolio_snapshots: сохраняем каждые 5 минут

    def open_position(self, signal_data):
        # КРИТИЧЕСКАЯ ЛОГИКА:
        # 1. Проверяем market timing (не открываем < 2 часов до закрытия)
        # 2. Вычисляем position_size (% от доступного cash)
        # 3. Получаем текущую цену от Yahoo Finance
        # 4. Вычисляем динамические stop_loss и take_profit
        # 5. Сохраняем в experiments table
        # 6. Учитываем commission (0.1%) и slippage

    def monitor_positions(self):
        # Вызывается каждые 30 секунд
        # 1. Получаем активные позиции
        # 2. Обновляем текущие цены
        # 3. Проверяем stop_loss / take_profit / max_hold_until
        # 4. Закрываем позиции при срабатывании

    def get_positions_at_risk(self):
        # БАГ БЫЛ ЗДЕСЬ! (ИСПРАВЛЕН)
        # OLD: SELECT * FROM experiments WHERE status = 'active'
        # NEW: SELECT * FROM experiments WHERE status = 'active'
        #      AND max_hold_until < NOW()

    def close_position(self, experiment_id, reason):
        # Закрывает позицию:
        # 1. Получает текущую цену
        # 2. Вычисляет P&L (gross_pnl, commission, net_pnl)
        # 3. Вычисляет alpha vs S&P 500
        # 4. Обновляет cash_balance
        # 5. Сохраняет в experiments с status='closed'
```

**КРИТИЧЕСКИЙ БАГ** (строки 515-544):

```python
# ❌ БАГ - закрывал ВСЕ активные позиции сразу
def get_positions_at_risk(self) -> List[Dict]:
    cursor.execute("""
        SELECT * FROM experiments WHERE status = 'active'
    """)
    # Это возвращало ВСЕ позиции, из-за чего они закрывались мгновенно

# ✅ ИСПРАВЛЕНИЕ
def get_positions_at_risk(self) -> List[Dict]:
    cursor.execute("""
        SELECT * FROM experiments
        WHERE status = 'active'
        AND max_hold_until < NOW()
    """)
    # Теперь только просроченные позиции
```

**Динамические Stop Loss / Take Profit** (строки 267-283):

```python
# Confidence-based stop loss (2-4%)
confidence = float(signal_data.get('confidence', 50))
stop_loss_percent = 2.0 + (confidence / 100.0) * 2.0

# Expected-move-based take profit (1.5x, capped at 8%)
expected_move = float(signal_data.get('expected_move', 3.0))
take_profit_percent = min(expected_move * 1.5, 8.0)

stop_loss_price = entry_price * (1 - stop_loss_percent / 100)
take_profit_price = entry_price * (1 + take_profit_percent / 100)
```

**Market Timing Integration** (строки 220-250):

```python
from market_timing import calculate_adjusted_max_hold

# Не открываем позицию если до закрытия рынка < 2 часов
adjusted_max_hold, timing_reason = calculate_adjusted_max_hold(
    entry_time=datetime.now(timezone.utc),
    desired_hold_duration=timedelta(hours=desired_hours),
    min_hold_duration=timedelta(hours=2)
)

if adjusted_max_hold is None:
    logger.warning(f"Cannot open position: {timing_reason}")
    return None
```

#### 2. `signal_extractor/wave_analyzer.py` (227 строк)

**Назначение**: DSPy + Claude AI для Elliott Wave анализа

**DSPy Signatures**:

```python
class WaveAnalysisSignature(dspy.Signature):
    """Анализ волновых эффектов новости"""

    # Входы
    headline = dspy.InputField(desc="Заголовок новости")
    summary = dspy.InputField(desc="Краткое содержание")
    news_age_minutes = dspy.InputField(desc="Возраст новости в минутах")
    market_status = dspy.InputField(desc="open/closed/weekend/pre_market/after_hours")
    wave_status = dspy.InputField(desc="Status для каждой волны 0-6")

    # Выходы
    optimal_wave = dspy.OutputField(desc="Номер оптимальной волны (0-10)")
    wave_reasoning = dspy.OutputField(desc="Почему эта волна")
    news_type = dspy.OutputField(desc="earnings/macro/regulatory/tech/crypto/other")
    market_impact = dspy.OutputField(desc="high/medium/low")

class SignalGenerationSignature(dspy.Signature):
    """Generate trading signals with BOTH BUY and SHORT"""

    # Входы
    headline = dspy.InputField(desc="News headline")
    summary = dspy.InputField(desc="News summary")
    optimal_wave = dspy.InputField(desc="Optimal wave number")
    wave_start_minutes = dspy.InputField(desc="Start time")
    wave_end_minutes = dspy.InputField(desc="End time")
    news_type = dspy.InputField(desc="News type")

    # Выходы
    tickers = dspy.OutputField(desc="Comma-separated tickers (max 5)")
    actions = dspy.OutputField(desc="BUY or SHORT, comma-separated. MUST analyze both directions.")
    expected_moves = dspy.OutputField(desc="Expected % moves")
    confidences = dspy.OutputField(desc="Confidence 0-100 (realistic: 40-80)")
    reasoning = dspy.OutputField(desc="Detailed reasoning for each ticker")
```

**УЛУЧШЕНИЯ В ПРОМПТАХ**:

```python
# КРИТИЧЕСКИЕ ИНСТРУКЦИИ для SHORT signals:
"""
1. Analyze both BULLISH and BEARISH implications of the news
2. Use SHORT signals when news is NEGATIVE for a company/sector
3. Use BUY signals when news is POSITIVE for a company/sector
4. Consider:
   - Direct impact on mentioned companies
   - Indirect impact on competitors/suppliers
   - Sector-wide effects
   - Market sentiment shifts
5. Be selective - only high-conviction trades with clear rationale
6. Confidence should reflect realistic probabilities (40-80% typical range)
"""
```

#### 3. `experiment_manager/market_timing.py` (NEW FILE - 150 строк)

**Назначение**: Предотвращает открытие позиций перед закрытием рынка

**Ключевая функция**:

```python
def calculate_adjusted_max_hold(
    entry_time: datetime,
    desired_hold_duration: timedelta,
    min_hold_duration: timedelta = timedelta(hours=2)
) -> Tuple[Optional[datetime], str]:
    """
    Стратегия:
    1. Если до закрытия < 2 часов: не открывать позицию
    2. Если max_hold выходит за закрытие: сократить до 15 минут до закрытия
    3. Иначе: использовать желаемое время
    """
    market_close = get_market_close_time(entry_time)
    time_until_close = market_close - entry_time
    safe_close_time = market_close - timedelta(minutes=15)

    if time_until_close < min_hold_duration:
        return None, f"Only {time_until_close} until close, need {min_hold_duration}"

    desired_max_hold = entry_time + desired_hold_duration

    if desired_max_hold > safe_close_time:
        return safe_close_time, "Adjusted to close before market"

    return desired_max_hold, f"Using desired {desired_hold_duration}"
```

#### 4. `experiment_manager/market_data.py` (300+ строк)

**Назначение**: Multi-source price provider с fallbacks

**Архитектура**:

```python
class MarketDataProvider:
    def __init__(self):
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        self.finnhub_key = os.getenv('FINNHUB_API_KEY')
        self.price_cache = {}  # {ticker: (price, timestamp)}
        self.cache_ttl = 60  # 60 seconds
        self.ticker_blacklist = {}  # {ticker: timestamp}
        self.blacklist_ttl = 3600  # 1 hour

    def get_current_price(self, ticker: str, allow_stale=False) -> Optional[float]:
        # 1. Check blacklist (если тикер недавно failed)
        # 2. Check cache (если price свежий < 60 секунд)
        # 3. Try Yahoo Finance (primary)
        # 4. Try Finnhub (fallback 1)
        # 5. Try Alpha Vantage (fallback 2)
        # 6. Try stale cache if allow_stale=True
        # 7. Add to blacklist if all failed
        # 8. Return None
```

**Blacklist для проблемных тикеров**:

```python
# Проблема: $TAN генерировал сотни ошибок
# ERROR - $TAN: possibly delisted; No price data found

# Решение: blacklist на 1 час
if ticker in self.ticker_blacklist:
    blacklist_age = time.time() - self.ticker_blacklist[ticker]
    if blacklist_age < self.blacklist_ttl:
        logger.debug(f"{ticker} is blacklisted ({blacklist_age/60:.1f}m)")
        return None

# При failure добавляем в blacklist
if price is None:
    self.ticker_blacklist[ticker] = time.time()
    logger.warning(f"❌ Failed to get price for {ticker} - blacklisted for 60min")
```

**Подавление логов Yahoo Finance**:

```python
def _get_price_yahoo(self, ticker: str) -> Optional[float]:
    try:
        # Отключаем ВСЕ логи yfinance и urllib3
        yf_logger = logging.getLogger('yfinance')
        original_level = yf_logger.level
        yf_logger.setLevel(logging.CRITICAL)

        urllib3_logger = logging.getLogger('urllib3')
        urllib3_original = urllib3_logger.level
        urllib3_logger.setLevel(logging.CRITICAL)

        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d", interval="1m")
            # ... fetch price ...
        finally:
            # Restore original log levels
            yf_logger.setLevel(original_level)
            urllib3_logger.setLevel(urllib3_original)
    except Exception as e:
        # Не логируем "delisted" или "no price data" (expected errors)
        if 'delisted' not in str(e).lower() and 'no price data' not in str(e).lower():
            logger.debug(f"Yahoo error for {ticker}: {e}")
        return None
```

#### 5. `frontend/src/components/ActivePositions.tsx` (400+ строк)

**Назначение**: Real-time мониторинг активных позиций

**5-секундные обновления**:

```typescript
const [positions, setPositions] = useState<Position[]>([]);
const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

useEffect(() => {
  loadPositions();
  const interval = setInterval(loadPositions, 5000);  // 5 seconds
  return () => clearInterval(interval);
}, [apiBaseUrl]);

const loadPositions = async () => {
  try {
    // 1. Fetch active positions
    const response = await fetch(`${apiBaseUrl}/api/positions/active`);
    const data = await response.json();

    // 2. Fetch current prices for all tickers
    const tickers = data.map((p: Position) => p.ticker).join(',');
    const priceRes = await fetch(
      `${apiBaseUrl}/api/market/current-prices?tickers=${tickers}`
    );
    const prices = await priceRes.json();

    // 3. Calculate unrealized P&L for each position
    const enriched = data.map((position: Position) => {
      const currentPrice = prices[position.ticker];
      const unrealizedPnl = (currentPrice - position.entry_price) * position.shares;
      const unrealizedPnlPct = (unrealizedPnl / position.position_size) * 100;

      return {
        ...position,
        current_price: currentPrice,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: unrealizedPnlPct
      };
    });

    setPositions(enriched);
    setLastUpdate(new Date());
  } catch (error) {
    console.error('Failed to load positions:', error);
  }
};
```

**Отображение с timestamp**:

```typescript
<div style={{ color: '#666' }}>
  🔄 Updated: {lastUpdate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}
</div>
```

#### 6. `frontend/src/components/PortfolioHistory.tsx` (NEW FILE - 500+ строк)

**Назначение**: История закрытых позиций с alpha calculation

**Ключевые фичи**:

```typescript
interface HistoryPosition {
  id: number;
  ticker: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  shares: number;
  net_pnl: number;
  return_percent: number;
  sp500_entry: number;
  sp500_exit: number;
  sp500_return: number;
  alpha: number;  // Наша доходность - S&P 500 доходность
  exit_reason: string;
  elliott_wave: number;
  headline: string;
}

// Фильтры
const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all');

// Пагинация
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 10;

// Summary статистика
const totalTrades = filteredHistory.length;
const profitableTrades = filteredHistory.filter(p => p.net_pnl > 0).length;
const totalPnL = filteredHistory.reduce((sum, p) => sum + p.net_pnl, 0);
const winRate = (profitableTrades / totalTrades) * 100;
const avgReturn = filteredHistory.reduce((sum, p) => sum + p.return_percent, 0) / totalTrades;
const avgAlpha = filteredHistory.reduce((sum, p) => sum + p.alpha, 0) / totalTrades;
```

#### 7. `frontend/src/services/websocket.ts` (100 строк)

**Назначение**: Real-time уведомления через WebSocket

**БАГ - Connection leak**:

```typescript
// ❌ БАГ - создавали новый WebSocket не закрывая старый
connect(): Promise<void> {
  this.ws = new WebSocket(this.url);
  // ... setup handlers ...
}

// ✅ ИСПРАВЛЕНИЕ - закрываем старый перед созданием нового
connect(): Promise<void> {
  // Close existing connection before creating new one
  if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
    console.log('Closing existing WebSocket before reconnecting');
    this.ws.close(1000, 'Reconnecting');
  }

  this.ws = new WebSocket(this.url);
  // ... setup handlers ...
}
```

**Проблема**: В Railway логах видели 8-9 WebSocket соединений одновременно, что приводило к memory leak и повторной обработке событий.

#### 8. `backend/main.py` (КРИТИЧЕСКИЙ!) vs `api_server/main.py`

**ВАЖНОЕ ОТКРЫТИЕ**: Railway деплоит `backend/main.py`, а не `api_server/main.py`!

**История**:

1. Изначально создали `api_server/main.py` с API endpoints
2. Добавили новый endpoint `/api/positions/history` для Portfolio History
3. После деплоя - 404 ошибка на `/api/positions/history`
4. Оказалось: Railway configuration указывает на `backend/main.py`
5. Решение: `cp api_server/main.py backend/main.py`

**railway.json**:

```json
{
  "services": {
    "backend": {
      "startCommand": "cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT"
    }
  }
}
```

**Все API endpoints**:

```python
@app.get("/api/positions/active")
async def get_active_positions():
    """Получить активные позиции"""

@app.get("/api/positions/history")
async def get_portfolio_history(limit: int = 100):
    """История закрытых позиций (NEW!)"""

@app.get("/api/signals/recent")
async def get_recent_signals(limit: int = 50):
    """Недавние торговые сигналы"""

@app.get("/api/market/current-prices")
async def get_current_prices(tickers: str):
    """Текущие цены для списка тикеров"""

@app.get("/api/portfolio/snapshot")
async def get_portfolio_snapshot():
    """Текущий snapshot портфеля"""

@app.get("/api/logs/service")
async def get_service_logs(service: str = None, limit: int = 100):
    """Логи сервисов (news_analyzer, signal_extractor, experiment_manager)"""

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket для real-time updates"""
```

#### 9. `frontend/public/index.html`

**Проблема browser caching**:

После деплоя новой версии, браузеры продолжали использовать старый JavaScript, вызывая 404 на несуществующих endpoints.

**Решение - cache-busting headers**:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <!-- Prevent caching of this HTML file -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />

    <title>WaveSens Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

**Дополнительно**: Пользователям нужно делать hard refresh (Ctrl+F5 / Cmd+Shift+R).

---

## API ключи и переменные окружения

### Полный список всех ключей

#### 1. OPENROUTER_API_KEY

**Назначение**: Доступ к Claude 3.7 Sonnet через OpenRouter

**Где используется**:
- `news_analyzer/config.py` - для оценки значимости новостей
- `signal_extractor/config.py` - для генерации торговых сигналов

**Текущее значение**: (секретное, хранится в Railway)

**Как получить**:
1. Зарегистрироваться на https://openrouter.ai/
2. Создать API key в Dashboard
3. Пополнить баланс ($5+ рекомендуется)

**Модель**: `anthropic/claude-3.7-sonnet`

**Стоимость**:
- Input: ~$3 per 1M tokens
- Output: ~$15 per 1M tokens
- Средний запрос: ~2000 input + 1000 output tokens = $0.03

**Использование**:

```python
import os
os.environ['OPENROUTER_API_KEY'] = 'sk-or-v1-...'

import dspy
lm = dspy.LM(
    model="openrouter/anthropic/claude-3.7-sonnet",
    temperature=0.3,
    max_tokens=4000
)
dspy.settings.configure(lm=lm)
```

#### 2. FINNHUB_API_KEY

**Назначение**: Real-time финансовые новости

**Где используется**:
- `news_analyzer/finnhub_client.py` - получение новостей каждые 5 секунд

**Текущее значение**: `d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0`

**Как получить**:
1. Зарегистрироваться на https://finnhub.io/
2. Бесплатный tier: 60 API calls/minute

**API endpoint**:
```
GET https://finnhub.io/api/v1/news?category=general&token={FINNHUB_API_KEY}
```

**Лимиты**:
- Free tier: 60 calls/minute
- Мы делаем 1 call каждые 5 секунд = 12 calls/minute ✅

**Пример ответа**:

```json
[
  {
    "category": "company news",
    "datetime": 1699999999,
    "headline": "Apple Announces Record Q4 Earnings",
    "id": 123456789,
    "image": "https://...",
    "related": "AAPL",
    "source": "Reuters",
    "summary": "Apple Inc. reported record fourth-quarter earnings...",
    "url": "https://..."
  }
]
```

#### 3. DATABASE_URL

**Назначение**: PostgreSQL connection string

**Где используется**:
- Все 3 блока (news_analyzer, signal_extractor, experiment_manager)
- Backend API server
- Migration scripts

**Railway Production**:
```
postgresql://postgres:mOuDnxmRDVGwbbXRjPvCwJNvTKkqmzWv@switchyard.proxy.rlwy.net:37344/railway
```

**Local Development**:
```
postgresql://localhost/wavesens
```

**Формат**:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Использование**:

```python
import psycopg2
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()
```

#### 4. ALPHA_VANTAGE_API_KEY

**Назначение**: Fallback для market data (когда Yahoo Finance fails)

**Где используется**:
- `experiment_manager/market_data.py` - fallback #2 для цен

**Текущее значение**: (опционально, можно не устанавливать)

**Как получить**:
1. Зарегистрироваться на https://www.alphavantage.co/
2. Бесплатный tier: 25 calls/day (очень мало!)

**Лимиты**:
- Free: 25 calls/day, 5 calls/minute
- Premium ($50/month): 500 calls/day

**Использование**:

```python
from alpha_vantage.timeseries import TimeSeries

ts = TimeSeries(key=ALPHA_VANTAGE_API_KEY, output_format='pandas')
data, meta_data = ts.get_quote_endpoint(symbol=ticker)
price = float(data['05. price'])
```

#### 5. Другие переменные окружения

**News Analyzer**:

```bash
SIGNIFICANCE_THRESHOLD=70          # Минимальный score для "значимой" новости
CHECK_INTERVAL_SECONDS=5           # Как часто опрашивать Finnhub
SKIP_NEWS_OLDER_HOURS=24           # Игнорировать новости старше N часов
MAX_NEWS_PER_CHECK=20              # Максимум новостей за один цикл
LLM_MODEL=anthropic/claude-3.7-sonnet
LLM_TEMPERATURE=0.3
LOG_LEVEL=INFO
```

**Signal Extractor**:

```bash
LLM_MODEL=anthropic/claude-3.7-sonnet
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=4000
LLM_TIMEOUT_SECONDS=30
MIN_EXPECTED_MOVE_PERCENT=1.0      # Минимальное ожидаемое движение цены
MIN_CONFIDENCE=40                  # Минимальная confidence для сигнала
MAX_SIGNALS_PER_NEWS=10            # Максимум сигналов от одной новости
DEFAULT_STOP_LOSS_PERCENT=2.0      # Default stop loss (теперь динамический)
DEFAULT_TAKE_PROFIT_PERCENT=3.0    # Default take profit (теперь динамический)
DEFAULT_MAX_HOLD_HOURS=6           # Default max hold time
LOG_LEVEL=INFO
```

**Experiment Manager**:

```bash
INITIAL_CAPITAL=100000             # Начальный виртуальный капитал
MAX_POSITION_SIZE_PERCENT=5.0      # Максимум 5% от капитала на одну позицию
MIN_POSITION_SIZE_USD=100          # Минимальный размер позиции
COMMISSION_PERCENT=0.1             # Комиссия 0.1% на сделку
SLIPPAGE_PERCENT=0.05              # Slippage 0.05%
MARKET_IMPACT_THRESHOLD=10000      # При позиции > $10k добавляем market impact
MONITOR_INTERVAL_SECONDS=30        # Проверяем позиции каждые 30 секунд
SNAPSHOT_INTERVAL_MINUTES=5        # Сохраняем portfolio snapshot каждые 5 минут
LOG_LEVEL=INFO
```

**Backend API**:

```bash
PORT=8000                          # Railway automatically sets this
HOST=0.0.0.0                       # Listen on all interfaces
```

### Как установить переменные в Railway

```bash
# 1. Railway CLI
railway login
railway link  # Выбрать проект wavesens

# 2. Установить переменные для всех сервисов
railway variables set OPENROUTER_API_KEY="sk-or-v1-..."
railway variables set FINNHUB_API_KEY="d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0"
railway variables set ALPHA_VANTAGE_API_KEY="..."  # optional

# 3. DATABASE_URL устанавливается автоматически Railway при создании Postgres

# 4. Проверить переменные
railway variables
```

### Локальная разработка - `.env` файл

```bash
# Создать .env в корне проекта
touch .env

# Содержимое .env:
OPENROUTER_API_KEY=sk-or-v1-...
FINNHUB_API_KEY=d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0
DATABASE_URL=postgresql://localhost/wavesens
ALPHA_VANTAGE_API_KEY=...  # optional
LOG_LEVEL=DEBUG

# Загрузить .env
python3 -c "from dotenv import load_dotenv; load_dotenv()"
```

**ВАЖНО**: Добавить `.env` в `.gitignore`!

```bash
# .gitignore
.env
.env.local
*.env
```

---

## Railway деплоймент

### Архитектура Railway проекта

WaveSens использует **Railway monorepo** с 5 сервисами:

```
wavesens (Project)
│
├── Service: backend
│   ├── Start Command: cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT
│   ├── URL: https://backend-production-xxxx.up.railway.app
│   └── Variables: DATABASE_URL, OPENROUTER_API_KEY, FINNHUB_API_KEY
│
├── Service: frontend
│   ├── Start Command: cd frontend && npm start
│   ├── URL: https://frontend-production-xxxx.up.railway.app
│   └── Variables: REACT_APP_API_URL (points to backend URL)
│
├── Service: news_analyzer (Block 1)
│   ├── Start Command: cd news_analyzer && python3 main.py
│   ├── No public URL (background worker)
│   └── Variables: DATABASE_URL, OPENROUTER_API_KEY, FINNHUB_API_KEY
│
├── Service: signal_extractor (Block 2)
│   ├── Start Command: cd signal_extractor && python3 main.py
│   ├── No public URL (background worker)
│   └── Variables: DATABASE_URL, OPENROUTER_API_KEY
│
├── Service: experiment_manager (Block 3)
│   ├── Start Command: cd experiment_manager && python3 main.py
│   ├── No public URL (background worker)
│   └── Variables: DATABASE_URL, FINNHUB_API_KEY, ALPHA_VANTAGE_API_KEY
│
└── Database: PostgreSQL
    ├── Automatically provisioned by Railway
    ├── DATABASE_URL automatically injected into all services
    └── Host: switchyard.proxy.rlwy.net:37344
```

### railway.json конфигурация

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Procfile для каждого сервиса

**backend/Procfile**:
```
web: cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

**frontend/Procfile**:
```
web: cd frontend && npm start
```

**news_analyzer/Procfile**:
```
worker: cd news_analyzer && python3 main.py
```

**signal_extractor/Procfile**:
```
worker: cd signal_extractor && python3 main.py
```

**experiment_manager/Procfile**:
```
worker: cd experiment_manager && python3 main.py
```

### Deployment процесс

**1. Создание проекта в Railway**

```bash
# Установить Railway CLI
npm install -g @railway/cli

# Логин
railway login

# Создать новый проект
railway init

# Связать с GitHub репозиторием
railway link
```

**2. Создание PostgreSQL database**

```bash
# В Railway Dashboard:
# 1. Click "New" → "Database" → "PostgreSQL"
# 2. Railway автоматически создаст DATABASE_URL
# 3. DATABASE_URL будет доступен во всех сервисах
```

**3. Настройка переменных окружения**

```bash
# Для всех сервисов одновременно
railway variables set OPENROUTER_API_KEY="sk-or-v1-..."
railway variables set FINNHUB_API_KEY="d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0"

# Для конкретного сервиса
railway service  # Выбрать frontend
railway variables set REACT_APP_API_URL="https://backend-production-xxxx.up.railway.app"
```

**4. Deploy всех сервисов**

```bash
# Auto-deploy при push в GitHub (рекомендуется)
git add .
git commit -m "Your changes"
git push origin main
# Railway автоматически задеплоит все изменённые сервисы

# Или manual deploy через CLI
railway up
```

**5. Мониторинг деплоя**

```bash
# Смотреть логи конкретного сервиса
railway logs --service backend
railway logs --service news_analyzer

# Смотреть логи в реальном времени
railway logs --follow

# Проверить статус всех сервисов
railway status
```

### Troubleshooting Railway deployment

**Проблема 1: Service crashes immediately after deploy**

```bash
# Логи показывают:
# ERROR: Could not find OPENROUTER_API_KEY

# Решение:
railway service  # Выбрать нужный сервис
railway variables set OPENROUTER_API_KEY="sk-or-v1-..."
railway restart
```

**Проблема 2: Frontend не подключается к Backend**

```bash
# Причина: REACT_APP_API_URL не установлен или неверный

# Решение:
railway service  # Выбрать frontend
railway variables set REACT_APP_API_URL="https://backend-production-xxxx.up.railway.app"
railway restart
```

**Проблема 3: Database connection refused**

```bash
# Логи показывают:
# psycopg2.OperationalError: could not connect to server

# Решение 1: Проверить DATABASE_URL
railway variables | grep DATABASE_URL

# Решение 2: Проверить что PostgreSQL сервис запущен
railway status

# Решение 3: Recreate database
# В Railway Dashboard: Database → Settings → Delete
# Затем создать новый PostgreSQL сервис
```

**Проблема 4: Build fails with "No Python version specified"**

```bash
# Причина: Railway не может определить версию Python

# Решение 1: Создать runtime.txt
echo "python-3.11" > runtime.txt
git add runtime.txt
git commit -m "Specify Python version"
git push

# Решение 2: Добавить в railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksPlan": {
      "phases": {
        "setup": {
          "nixPkgs": ["python311"]
        }
      }
    }
  }
}
```

**Проблема 5: Service runs locally but fails on Railway**

```bash
# Причина: Зависимости не установлены

# Решение: Проверить requirements.txt
# Для каждого сервиса должен быть свой requirements.txt

# news_analyzer/requirements.txt
psycopg2-binary==2.9.9
finnhub-python==2.4.19
dspy-ai==2.4.0
openai>=1.0.0
python-dotenv==1.0.0

# Убедиться что установлены все зависимости:
cd news_analyzer
pip install -r requirements.txt
python3 main.py  # Test locally first
```

### URLs всех сервисов

**Production (Railway)**:

```
Frontend:         https://frontend-production-xxxx.up.railway.app
Backend API:      https://backend-production-xxxx.up.railway.app
PostgreSQL:       switchyard.proxy.rlwy.net:37344
```

**Local Development**:

```
Frontend:         http://localhost:3000
Backend API:      http://localhost:8000
PostgreSQL:       localhost:5432
```

### Мониторинг Railway в реальном времени

```bash
# Terminal 1: Backend logs
railway logs --service backend --follow

# Terminal 2: News Analyzer logs
railway logs --service news_analyzer --follow

# Terminal 3: Signal Extractor logs
railway logs --service signal_extractor --follow

# Terminal 4: Experiment Manager logs
railway logs --service experiment_manager --follow

# Terminal 5: Database metrics
railway database metrics
```

### Railway pricing

**Current usage**:
- 5 services × $5/month = $25/month
- PostgreSQL database: $10/month
- Total: ~$35/month

**Free tier alternative** (с ограничениями):
- 500 hours/month execution time (shared across all services)
- 100GB network egress
- 1GB database storage

---

