# 🌊 WaveSens - Intelligent Trading Signal Analysis System

**Полноценная система анализа волновых эффектов новостей с виртуальной торговлей и real-time мониторингом**

## 🎯 Назначение

WaveSens - это исследовательская торговая система, которая:
1. **Анализирует финансовые новости** через LLM для определения значимости
2. **Генерирует торговые сигналы** на основе теории волновых эффектов
3. **Исполняет виртуальные сделки** с реалистичной симуляцией
4. **Тестирует эффективность** стратегии против S&P 500

## 📊 Live System Status

```
📈 Portfolio: $10,456 (+4.56%)
🎯 Today's P&L: +$234 (+2.3%)
✅ Win Rate: 64% (23W/13L)
📊 vs S&P 500: +2.3% Alpha
🔄 Active Positions: 8
```

## 🏗️ Архитектура системы

### Event-Driven Pipeline
```
┌─────────────────┐    PostgreSQL     ┌─────────────────┐    PostgreSQL     ┌─────────────────┐
│   БЛОК 1        │    NOTIFY         │   БЛОК 2        │    NOTIFY         │   БЛОК 3        │
│ News Analyzer   │ ──────────────→   │Signal Extractor │ ──────────────→   │Experiment       │
│                 │new_significant    │                 │new_trading        │Manager          │
│                 │_news              │                 │_signals           │                 │
└─────────────────┘                   └─────────────────┘                   └─────────────────┘
       │                                       │                                       │
       ▼                                       ▼                                       ▼
   Finnhub API                          DSPy + Claude                           Yahoo Finance
   LLM Analysis                         Wave Analysis                          Virtual Trading
   PostgreSQL                          Ticker Validation                      Portfolio Management
```

### Wave Analysis Theory
```
Wave 0 (0-5 min):    🤖 HFT алгоритмы
Wave 1 (5-30 min):   💰 Smart money
Wave 2 (30-120 min): 🏦 Институционалы
Wave 3 (2-6 hours):  🎓 Информированный retail
Wave 4 (6-24 hours): 👥 Массовый retail
Wave 5 (1-3 days):   📊 Переоценка
Wave 6+ (3-7 days):  🔄 Фундаментальный сдвиг
```

## 🔗 БЛОК 1: News Analyzer

**Цель**: Мониторинг финансовых новостей, анализ значимости через LLM

### Функциональность
- Мониторинг Finnhub API каждые 5 секунд
- LLM анализ значимости новостей (Claude Haiku)
- Сохранение значимых новостей в PostgreSQL
- Отправка PostgreSQL NOTIFY для БЛОК 2

### Технологии
- **API**: Finnhub Financial News
- **LLM**: DSPy + OpenRouter + Claude Haiku
- **Database**: PostgreSQL
- **Architecture**: Event-driven polling

### Ключевые файлы
```
news_analyzer/
├── main.py           # Основной сервис
├── analyzer.py       # LLM анализ новостей
├── storage.py        # PostgreSQL операции
├── config.py         # Конфигурация
└── schema.sql        # Схема базы данных
```

## ⚡ БЛОК 2: Signal Extractor

**Цель**: Преобразование значимых новостей в торговые сигналы через wave analysis

### Функциональность
- Event-driven: слушает PostgreSQL NOTIFY
- Анализ волновых эффектов (0-6+ waves)
- Генерация торговых сигналов через LLM
- Валидация тикеров через yfinance
- Определение статуса рынка (weekend/hours)

### Wave Analysis Theory
```
Wave 0 (0-5 min):    HFT алгоритмы
Wave 1 (5-30 min):   Smart money
Wave 2 (30-120 min): Институционалы
Wave 3 (2-6 hours):  Информированный retail
Wave 4 (6-24 hours): Массовый retail
Wave 5 (1-3 days):   Переоценка
Wave 6+ (3-7 days):  Фундаментальный сдвиг
```

### Технологии
- **LLM**: DSPy + OpenRouter + Claude Sonnet
- **Validation**: yfinance для проверки тикеров
- **Market Data**: Timezone-aware market status
- **Architecture**: PostgreSQL LISTEN/NOTIFY

### Ключевые файлы
```
signal_extractor/
├── main.py              # Event-driven сервис
├── wave_analyzer.py     # DSPy signatures и LLM
├── market_status.py     # Определение статуса рынка
├── ticker_validator.py  # Валидация тикеров
├── config.py           # Конфигурация
└── schema.sql          # Схема сигналов
```

## 💰 БЛОК 3: Experiment Manager

**Цель**: Виртуальная торговая площадка для тестирования стратегии

### Функциональность
- Event-driven получение сигналов
- Виртуальное исполнение сделок
- Risk management и position sizing
- Мониторинг позиций каждые 30 секунд
- Бенчмарк против S&P 500
- Детальная аналитика результатов

### Виртуальный портфель
- **Стартовый капитал**: $10,000
- **Комиссии**: $1 или 0.1%
- **Slippage**: 0.05-0.2%
- **Лимиты**: 10% на позицию, 20 позиций макс
- **Risk limits**: 5% daily loss limit

### Технологии
- **Market Data**: Yahoo Finance API
- **Execution**: Realistic slippage/commission simulation
- **Risk Management**: Multiple safety layers
- **Analytics**: Real-time P&L tracking

## 🗄️ База данных

### Основные таблицы
```sql
-- Новости (БЛОК 1)
news (id, headline, summary, url, published_at, is_significant, significance_score, reasoning)

-- Сигналы (БЛОК 2)
signals (id, news_id, ticker, action, wave, entry_times, expected_move, confidence)

-- Эксперименты (БЛОК 3)
experiments (id, signal_id, entry_price, exit_price, pnl, return_percent, alpha)

-- Снимки портфеля
portfolio_snapshots (timestamp, total_value, cash_balance, unrealized_pnl)
```

## 🚀 Запуск системы

### Требования
```bash
# Установка зависимостей
pip install psycopg2 dspy-ai yfinance pytz requests

# PostgreSQL
brew install postgresql
createdb news_analyzer
```

### Переменные окружения
```bash
# API ключи
export FINNHUB_API_KEY="your_finnhub_key"
export OPENROUTER_API_KEY="your_openrouter_key"

# База данных
export DATABASE_URL="postgresql://localhost/news_analyzer"

# Опционально
export LLM_MODEL="anthropic/claude-3-haiku"
export INITIAL_CAPITAL="10000"
```

### Инициализация БД
```bash
# БЛОК 1
cd news_analyzer && psql $DATABASE_URL -f schema.sql

# БЛОК 2
cd signal_extractor && psql $DATABASE_URL -f schema.sql

# БЛОК 3
cd experiment_manager && psql $DATABASE_URL -f schema.sql
```

### Запуск сервисов
```bash
# Терминал 1: БЛОК 1 - анализ новостей
cd news_analyzer && python main.py

# Терминал 2: БЛОК 2 - генерация сигналов
cd signal_extractor && python main.py

# Терминал 3: БЛОК 3 - виртуальная торговля
cd experiment_manager && python main.py
```

## 📊 Мониторинг

### Логи
- **INFO**: Основные события (новые новости, сигналы, сделки)
- **DEBUG**: Детальная информация
- **ERROR**: Ошибки с fallback логикой

### Метрики (БЛОК 3)
- Portfolio value vs S&P 500
- Win rate и average returns
- Sharpe ratio и maximum drawdown
- Wave analysis effectiveness
- Alpha generation

### SQL запросы для анализа
```sql
-- Активные позиции
SELECT * FROM experiments WHERE status = 'active';

-- Performance сегодня
SELECT COUNT(*), AVG(return_percent), SUM(net_pnl)
FROM experiments WHERE date(exit_time) = CURRENT_DATE;

-- Alpha vs S&P 500
SELECT AVG(return_percent - sp500_return) as avg_alpha
FROM experiments WHERE status = 'closed';
```

## 🛡️ Risk Management

### БЛОК 2
- Weekend delay detection
- Market hours validation
- Ticker existence validation
- LLM fallback mechanisms

### БЛОК 3
- Position sizing limits (10% max)
- Daily loss limits (5%)
- Stop loss/take profit automation
- Cash reserve requirements (10%)
- Maximum concurrent positions (20)

## 🎯 Особенности реализации

- **Без моков**: Реальные API интеграции
- **Event-driven**: PostgreSQL NOTIFY/LISTEN
- **Fault tolerant**: Comprehensive error handling
- **Realistic simulation**: Комиссии, slippage, лимиты
- **LLM-powered**: Интеллектуальный анализ через DSPy
- **Benchmarked**: Постоянное сравнение с S&P 500

## 📈 Результаты

Система предназначена для:
1. **Исследования**: Какие типы новостей генерируют альфу
2. **Validation**: Работает ли wave analysis theory
3. **Optimization**: Настройка параметров стратегии
4. **Risk assessment**: Понимание drawdown и volatility

---

**WaveSens** - полноценная система для исследования влияния новостей на финансовые рынки через призму волновой теории и машинного обучения.