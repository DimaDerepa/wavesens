# 🚀 WaveSens Deployment Guide

This guide covers deploying WaveSens to Railway.app with the complete architecture.

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your WaveSens code to GitHub
3. **API Keys**: Ensure you have the required API keys

## 🏗️ Architecture Overview

The deployed system consists of:
- **Frontend**: React dashboard (served via Nginx)
- **Backend**: FastAPI server with WebSocket support
- **Database**: PostgreSQL (Railway managed)
- **Core Services**: Three WaveSens blocks (news_analyzer, signal_extractor, experiment_manager)

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

```bash
# In Railway dashboard, add PostgreSQL service
# Get the DATABASE_URL from Railway environment variables
```

### 2. Initialize Database Schema

```bash
# Run schema files in order:
psql $DATABASE_URL -f news_analyzer/schema.sql
psql $DATABASE_URL -f signal_extractor/schema.sql
psql $DATABASE_URL -f experiment_manager/schema.sql
```

## 🔧 Environment Variables

### Backend Service
```env
DATABASE_URL=postgresql://...
FINNHUB_API_KEY=your_finnhub_key
OPENROUTER_API_KEY=your_openrouter_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

### Frontend Service
```env
REACT_APP_API_URL=https://your-backend-url.railway.app
REACT_APP_WS_URL=wss://your-backend-url.railway.app/ws
```

## 🚢 Railway Deployment

### 1. Backend Deployment

1. Create new Railway project
2. Connect your GitHub repository
3. Select `backend` folder as root directory
4. Set environment variables in Railway dashboard
5. Deploy using the provided Dockerfile

Railway will automatically:
- Build the Docker image
- Install Python dependencies
- Start the FastAPI server on port 8000

### 2. Frontend Deployment

1. Add new service to Railway project
2. Connect same GitHub repository
3. Select `frontend` folder as root directory
4. Set environment variables (API URLs)
5. Deploy using the provided Dockerfile

Railway will automatically:
- Build React application
- Serve via Nginx on port 80
- Handle routing for SPA

### 3. Core Services Deployment

Deploy each of the three core services as separate Railway services:

#### News Analyzer
```bash
# In Railway dashboard
Root Directory: news_analyzer
Start Command: python main.py
Environment: DATABASE_URL, FINNHUB_API_KEY, OPENROUTER_API_KEY
```

#### Signal Extractor
```bash
# In Railway dashboard
Root Directory: signal_extractor
Start Command: python main.py
Environment: DATABASE_URL, OPENROUTER_API_KEY
```

#### Experiment Manager
```bash
# In Railway dashboard
Root Directory: experiment_manager
Start Command: python main.py
Environment: DATABASE_URL, ALPHA_VANTAGE_API_KEY
```

## 🔗 Service URLs

After deployment, you'll have:
- **Frontend**: `https://your-frontend.railway.app`
- **Backend API**: `https://your-backend.railway.app`
- **WebSocket**: `wss://your-backend.railway.app/ws`

## ✅ Health Checks

Each service includes health check endpoints:

- **Frontend**: `GET /health`
- **Backend**: `GET /health`
- **Core Services**: Check logs for "running" status

## 📊 Monitoring

Railway provides built-in monitoring for:
- CPU/Memory usage
- Request metrics
- Logs aggregation
- Uptime monitoring

## 🔐 Security Configuration

### Backend CORS
The FastAPI backend is configured to allow connections from the frontend domain. Update CORS settings in production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.railway.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Database Security
- Use Railway's managed PostgreSQL with SSL
- Rotate database credentials regularly
- Enable connection pooling for performance

## 🚀 Deployment Commands

### Manual Deployment
```bash
# Backend
railway login
railway project create wavesens-backend
railway add --name backend
railway deploy

# Frontend
railway project create wavesens-frontend
railway add --name frontend
railway deploy
```

### Automated Deployment
Railway automatically deploys on git push when connected to GitHub.

## 🔄 Updates & Rollbacks

### Rolling Updates
Railway supports zero-downtime deployments:
1. Push changes to GitHub
2. Railway builds new version
3. Health checks pass
4. Traffic switches to new version

### Rollbacks
```bash
railway rollback <deployment-id>
```

## 📈 Scaling

### Horizontal Scaling
```bash
railway scale --replicas 3
```

### Vertical Scaling
Railway auto-scales based on resource usage.

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database is running
   - Check network connectivity

2. **WebSocket Connection Issues**
   - Ensure WSS protocol for HTTPS frontend
   - Check CORS configuration
   - Verify WebSocket endpoint

3. **Build Failures**
   - Check Dockerfile syntax
   - Verify all dependencies in requirements.txt
   - Check build logs in Railway dashboard

### Debug Commands
```bash
# View logs
railway logs

# Check service status
railway status

# SSH into container (if enabled)
railway shell
```

## 📞 Support

For Railway-specific issues:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Support](https://railway.app/help)

For WaveSens issues:
- Check application logs
- Review health check endpoints
- Verify environment variables