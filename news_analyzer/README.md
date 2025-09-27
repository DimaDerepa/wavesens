# NEWS ANALYZER - БЛОК 1

## Назначение
Автоматический анализатор новостей для финансовых рынков. Получает новости из Finnhub каждые 5 секунд, анализирует их значимость через LLM и сохраняет в PostgreSQL.

## Архитектура

### Компоненты системы
- **main.py** - основной сервис с циклом опроса
- **config.py** - конфигурация через переменные окружения
- **storage.py** - работа с PostgreSQL (psycopg2)
- **analyzer.py** - анализ значимости через DSPy + OpenRouter
- **schema.sql** - схема базы данных

### Поток данных
1. Finnhub API → новости каждые 5 секунд
2. Фильтрация дубликатов и старых новостей (>24ч)
3. LLM анализ → балл значимости (0-100) + рассуждение
4. Сохранение в PostgreSQL + NOTIFY для следующих блоков

## Технологии

### API и LLM
- **Finnhub API** - источник новостей (category: general)
- **OpenRouter API** - доступ к Claude 3 Haiku
- **DSPy** - структурированные запросы к LLM без парсинга JSON
- **LiteLLM** - унифицированный интерфейс к LLM

### База данных
- **PostgreSQL** - основное хранилище
- **psycopg2-binary** - драйвер для Python
- Автоматическое переподключение при сбоях

### Конфигурация
```bash
# Обязательные
FINNHUB_API_KEY=xxx
OPENROUTER_API_KEY=xxx
DATABASE_URL=postgresql://localhost/news_analyzer

# Опциональные
SIGNIFICANCE_THRESHOLD=70      # Порог значимости
CHECK_INTERVAL_SECONDS=5       # Интервал опроса
SKIP_NEWS_OLDER_HOURS=24      # Игнорировать новости старше
MAX_NEWS_PER_CHECK=20         # Максимум новостей за запрос
LLM_MODEL=anthropic/claude-3-haiku
LLM_TEMPERATURE=0.3
LOG_LEVEL=INFO
```

## Схема базы данных

```sql
CREATE TABLE news (
    id VARCHAR(100) PRIMARY KEY,      -- "finnhub:12345"
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    significance_score INTEGER,       -- 0-100
    reasoning TEXT,                   -- LLM объяснение
    is_significant BOOLEAN,           -- score >= threshold
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_processed_at ON news(processed_at DESC);
CREATE INDEX idx_significant ON news(is_significant) WHERE is_significant = TRUE;
```

## LLM Анализ

### DSPy сигнатура
```python
class NewsSignificanceSignature(dspy.Signature):
    headline = dspy.InputField(desc="Заголовок новости")
    summary = dspy.InputField(desc="Краткое содержание новости")

    significance_score = dspy.OutputField(desc="Балл значимости от 0 до 100")
    is_significant = dspy.OutputField(desc="Значимая ли новость (true/false)")
    reasoning = dspy.OutputField(desc="Объяснение почему важно или неважно")
```

### Примеры результатов
- **Балл 80**: "Amazon building $35B business" - влияние на конкурентов и рынок
- **Балл 70**: "Trump Argentina policy" - геополитические последствия
- **Балл 0**: "Jimmy Kimmel returns" - нет влияния на рынки

## Логирование

### Уровни
- **INFO** - старт сервиса, значимые новости, статистика
- **DEBUG** - обработка каждой новости, LLM вызовы
- **ERROR** - API ошибки, сбои БД, таймауты LLM
- **WARNING** - старые новости, дубликаты

### Примеры логов
```
[2025-09-27 10:54:36] INFO - Starting News Analyzer
[2025-09-27 10:54:36] INFO - Config: threshold=70, interval=5s, model=anthropic/claude-3-haiku
[2025-09-27 10:54:39] INFO - 📰 SIGNIFICANT [80]: First Amazon conquered retail...
[2025-09-27 10:54:40] DEBUG - Processing: Tesla announces production cut...
[2025-09-27 10:54:41] DEBUG - LLM response: score=60, reasoning=Limited market impact...
```

### Часовая статистика
```
📊 Hourly stats:
  Checks: 720
  News processed: 45
  Significant: 8 (17.8%)
  LLM calls: 45
  LLM tokens used: ~9,000
  Errors: 0
  Uptime: 1:00:00
```

## Обработка ошибок

### API таймауты
- Finnhub: 30 секунд таймаут
- OpenRouter: автоматические retry через DSPy
- Логирование всех сбоев

### База данных
- Автоматическое переподключение
- Проверка дубликатов перед вставкой
- Транзакционная безопасность

### Graceful shutdown
- Обработка SIGINT/SIGTERM
- Логирование финальной статистики
- Корректное закрытие соединений

## Запуск и тестирование

### Установка зависимостей
```bash
pip install dspy-ai psycopg2-binary requests
```

### Запуск
```bash
cd news_analyzer
FINNHUB_API_KEY=xxx OPENROUTER_API_KEY=xxx python3 main.py
```

### Мониторинг
```bash
# Последние новости
psql news_analyzer -c "SELECT headline, significance_score FROM news ORDER BY processed_at DESC LIMIT 10;"

# Статистика
psql news_analyzer -c "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_significant) as significant FROM news;"

# Производительность
tail -f logs/news_analyzer.log | grep "📰 SIGNIFICANT"
```

## Интеграция с другими блоками

### Для БЛОК 2 (Signal Extractor)
Система готова отправлять PostgreSQL NOTIFY при обнаружении значимых новостей:
```sql
-- После сохранения значимой новости
NOTIFY new_significant_news, 'finnhub:12345';
```

### Доступные данные
БЛОК 2 может получить через news_id:
- Заголовок и краткое содержание
- Время публикации (для расчета возраста)
- Балл значимости и рассуждение LLM
- URL оригинальной новости

## Производительность

### Метрики (реальные данные)
- **Throughput**: 20 новостей за ~10 минут
- **Hit rate**: 20% значимых новостей (4 из 20)
- **Латентность LLM**: 2-4 секунды на анализ
- **Memory usage**: ~50MB RAM
- **Database size**: ~1KB на новость

### Масштабирование
- Горизонтальное: несколько инстансов с разными категориями
- Вертикальное: увеличение MAX_NEWS_PER_CHECK
- Кеширование: Redis для частых LLM запросов