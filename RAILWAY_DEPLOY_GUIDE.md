# 🚀 WaveSens Railway Deployment Guide

## ✅ Completed Setup

All deployment files have been created:

- ✅ **Dockerfiles**: Created for all 5 services
- ✅ **Requirements.txt**: Created for Python services
- ✅ **Railway.json**: Created for all services
- ✅ **Railway CLI**: Installed and ready

## 📁 Project Structure

```
wavesens/
├── backend/          (FastAPI server)
├── frontend/         (React dashboard)
├── news_analyzer/    (Block 1)
├── signal_extractor/ (Block 2)
├── experiment_manager/ (Block 3)
└── RAILWAY_DEPLOY_GUIDE.md
```

## 🔧 Next Steps for Deployment

### 1. Railway Authentication

Since Railway CLI requires interactive login, you need to:

```bash
# In terminal (not CLI), run:
railway login
# This will open browser for GitHub/Google login
```

### 2. Create Project and Database

```bash
# Create new Railway project
railway new wavesens

# Add PostgreSQL database
railway add postgresql
```

### 3. Deploy Services (in order)

#### A. Database First
```bash
# Railway will automatically create PostgreSQL
# Note the DATABASE_URL from environment variables
```

#### B. Backend API
```bash
cd backend/
railway up

# Set environment variables in Railway dashboard:
# DATABASE_URL=<from-postgresql-service>
```

#### C. Deploy Core Blocks (in parallel)
```bash
# News Analyzer (Block 1)
cd ../news_analyzer/
railway up

# Signal Extractor (Block 2)
cd ../signal_extractor/
railway up

# Experiment Manager (Block 3)
cd ../experiment_manager/
railway up
```

#### D. Frontend
```bash
cd ../frontend/
railway up

# Set environment variables:
# REACT_APP_API_URL=https://your-backend.railway.app
# REACT_APP_WS_URL=wss://your-backend.railway.app/ws
```

### 4. Environment Variables Setup

#### Backend Service:
```
DATABASE_URL=postgresql://user:pass@host:port/db
```

#### News Analyzer:
```
DATABASE_URL=postgresql://user:pass@host:port/db
FINNHUB_API_KEY=d367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0
OPENROUTER_API_KEY=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
```

#### Signal Extractor:
```
DATABASE_URL=postgresql://user:pass@host:port/db
OPENROUTER_API_KEY=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
```

#### Experiment Manager:
```
DATABASE_URL=postgresql://user:pass@host:port/db
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

#### Frontend:
```
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_WS_URL=wss://your-backend.railway.app/ws
```

### 5. Initialize Database Schema

Once PostgreSQL is running, initialize the schema:

```bash
# Connect to Railway PostgreSQL and run:
psql $DATABASE_URL -f news_analyzer/schema.sql
psql $DATABASE_URL -f signal_extractor/schema.sql
psql $DATABASE_URL -f experiment_manager/schema.sql
```

### 6. Verify Deployment

Check each service is running:
- **Frontend**: `https://your-frontend.railway.app`
- **Backend API**: `https://your-backend.railway.app/health`
- **Blocks**: Check Railway logs for "running" status

## 🔗 Service Architecture

```
Internet → Frontend (React) → Backend (FastAPI) → Database (PostgreSQL)
                                      ↓
                               [News Analyzer] ← Finnhub API
                                      ↓
                               [Signal Extractor] ← OpenRouter API
                                      ↓
                               [Experiment Manager] ← Alpha Vantage API
```

## 📊 Expected Result

After successful deployment:
- **6 services** running on Railway
- **Real-time dashboard** at frontend URL
- **Complete trading system** with news analysis, signal generation, and experiment management
- **WebSocket** live updates
- **API endpoints** for all data

## 🚨 Important Notes

1. **API Keys**: Ensure all API keys are valid and have sufficient quotas
2. **Database**: PostgreSQL schema must be initialized before starting Python services
3. **Dependencies**: Services start in sequence - database → backend → blocks → frontend
4. **WebSocket**: Frontend uses WSS for HTTPS deployments
5. **CORS**: Backend allows all origins (configure for production)

## 🔧 Troubleshooting

### Common Issues:
1. **Build failures**: Check Dockerfile and requirements.txt
2. **Database errors**: Verify DATABASE_URL and schema initialization
3. **API errors**: Check environment variables and API key validity
4. **WebSocket issues**: Ensure WSS protocol for HTTPS frontend

### Debug Commands:
```bash
railway logs          # View service logs
railway status        # Check deployment status
railway variables     # List environment variables
```

---

All files are ready for deployment! Just need to authenticate with Railway and follow the steps above.