# 🚀 WaveSens Manual Deployment Guide

## ⚠️ Railway Authentication Required

Railway CLI требует интерактивного логина через браузер. Чтобы завершить деплой, выполните следующие шаги:

### 1. Авторизация в Railway

```bash
# В терминале выполните:
cd /Users/derepadmitrij/projs/wavesens
railway login
# Откроется браузер для GitHub/Google авторизации
```

### 2. Создание проекта и деплой

После успешной авторизации:

```bash
# Создать новый проект
railway init

# Добавить PostgreSQL
railway add postgresql

# Деплой каждого сервиса
cd backend && railway up
cd ../frontend && railway up
cd ../news_analyzer && railway up
cd ../signal_extractor && railway up
cd ../experiment_manager && railway up
```

## 🔄 Альтернативные платформы деплоя

### Option 1: Docker Compose (Local Production)

Создадим docker-compose.yml для локального продакшн деплоя:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: wavesens
      POSTGRES_USER: wavesens
      POSTGRES_PASSWORD: password123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://wavesens:password123@postgres:5432/wavesens
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      REACT_APP_API_URL: http://localhost:8000
      REACT_APP_WS_URL: ws://localhost:8000/ws
    depends_on:
      - backend

  news_analyzer:
    build: ./news_analyzer
    environment:
      DATABASE_URL: postgresql://wavesens:password123@postgres:5432/wavesens
      FINNHUB_API_KEY: d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0
      OPENROUTER_API_KEY: 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
    depends_on:
      - postgres

  signal_extractor:
    build: ./signal_extractor
    environment:
      DATABASE_URL: postgresql://wavesens:password123@postgres:5432/wavesens
      OPENROUTER_API_KEY: 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
    depends_on:
      - postgres

  experiment_manager:
    build: ./experiment_manager
    environment:
      DATABASE_URL: postgresql://wavesens:password123@postgres:5432/wavesens
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Option 2: Heroku Deployment

```bash
# Для каждого сервиса создать отдельное Heroku приложение
heroku create wavesens-backend
heroku create wavesens-frontend
heroku create wavesens-news-analyzer
heroku create wavesens-signal-extractor
heroku create wavesens-experiment-manager

# Добавить PostgreSQL
heroku addons:create heroku-postgresql:mini --app wavesens-backend
```

### Option 3: DigitalOcean App Platform

Создать app.yaml:

```yaml
name: wavesens
services:
- name: backend
  source_dir: /backend
  github:
    repo: your-username/wavesens
    branch: main
  run_command: uvicorn main:app --host 0.0.0.0 --port 8080
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs

- name: frontend
  source_dir: /frontend
  github:
    repo: your-username/wavesens
    branch: main
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs

databases:
- name: wavesens-db
  engine: PG
  version: "15"
  size: db-s-dev-database
```

## 🎯 Рекомендованный путь деплоя

### 1. Quick Start с Docker Compose

Самый простой способ запустить продакшн версию локально:

```bash
cd /Users/derepadmitrij/projs/wavesens

# Создать docker-compose.yml
# Запустить все сервисы
docker-compose up -d

# Инициализировать базу данных
docker-compose exec postgres psql -U wavesens -d wavesens -f /schema.sql
```

### 2. После тестирования - Railway

После проверки работоспособности системы через Docker Compose:

```bash
# Авторизоваться в Railway
railway login

# Деплой на Railway по инструкции выше
```

## 📋 Текущий статус

✅ **Готово к деплою:**
- Все Dockerfiles созданы
- Requirements.txt настроены
- Railway.json конфигурации готовы
- Environment variables определены
- Deployment guide создан

🔄 **Нужно выполнить:**
- Railway login (интерактивно)
- Создание проекта
- Деплой сервисов
- Настройка environment variables
- Инициализация базы данных

## 🚀 Команды для быстрого старта

После `railway login`:

```bash
cd /Users/derepadmitrij/projs/wavesens

# Backend
cd backend && railway up
echo "Backend deployed! Set DATABASE_URL in Railway dashboard"

# Frontend
cd ../frontend && railway up
echo "Frontend deployed! Set REACT_APP_API_URL and REACT_APP_WS_URL"

# Core Services
cd ../news_analyzer && railway up
cd ../signal_extractor && railway up
cd ../experiment_manager && railway up

echo "All services deployed! Initialize database schema next"
```

---

**Next Action:** Выполните `railway login` в терминале и следуйте этому guide'у!