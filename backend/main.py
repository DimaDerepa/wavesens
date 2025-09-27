#!/usr/bin/env python3
"""
FastAPI Backend for WaveSens Dashboard
Provides REST API and WebSocket endpoints for the frontend
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/news_analyzer')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="WaveSens API",
    description="REST API and WebSocket server for WaveSens Dashboard",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Database connection pool
class DatabaseManager:
    def __init__(self):
        self.connection_pool = []
        self.max_connections = 10

    def get_connection(self):
        try:
            return psycopg2.connect(
                DATABASE_URL,
                cursor_factory=psycopg2.extras.RealDictCursor
            )
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise HTTPException(status_code=500, detail="Database connection failed")

    def execute_query(self, query: str, params: tuple = None):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, params)

            if query.strip().upper().startswith('SELECT'):
                result = cursor.fetchall()
                return [dict(row) for row in result]
            else:
                conn.commit()
                return cursor.rowcount
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Query execution error: {e}")
            raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
        finally:
            if conn:
                conn.close()

db_manager = DatabaseManager()

# Pydantic models
class NewsItem(BaseModel):
    id: str
    headline: str
    summary: Optional[str]
    url: Optional[str]
    published_at: datetime
    is_significant: bool
    significance_score: Optional[float]
    reasoning: Optional[str]
    created_at: datetime

class Signal(BaseModel):
    id: str
    news_id: str
    ticker: str
    action: str
    wave: int
    entry_start: datetime
    entry_optimal: datetime
    entry_end: datetime
    expected_move_percent: Optional[float]
    confidence: int
    reasoning: Optional[str]
    created_at: datetime

class Experiment(BaseModel):
    id: str
    signal_id: str
    news_id: str
    ticker: str
    action: str
    confidence: int
    entry_time: datetime
    exit_time: Optional[datetime]
    position_size: float
    shares: float
    entry_price: float
    exit_price: Optional[float]
    stop_loss_price: float
    take_profit_price: float
    commission: float
    gross_pnl: Optional[float]
    net_pnl: Optional[float]
    return_percent: Optional[float]
    sp500_return: Optional[float]
    alpha: Optional[float]
    exit_reason: Optional[str]
    status: str

class PortfolioSnapshot(BaseModel):
    timestamp: datetime
    total_value: float
    cash_balance: float
    positions_value: float
    unrealized_pnl: float
    realized_pnl_today: float
    positions_count: int
    sp500_value: float
    benchmark_return: float
    total_return: float
    alpha: float

# API Endpoints

@app.get("/")
async def root():
    return {"message": "WaveSens API Server", "version": "1.0.0", "status": "running"}

@app.get("/api/dashboard/metrics")
async def get_dashboard_metrics():
    """Get comprehensive dashboard metrics"""
    try:
        # Portfolio metrics
        portfolio_query = """
            SELECT
                total_value,
                cash_balance,
                positions_count,
                realized_pnl_today,
                total_return,
                alpha_daily
            FROM portfolio_snapshots
            ORDER BY timestamp DESC
            LIMIT 1
        """
        portfolio_data = db_manager.execute_query(portfolio_query)
        portfolio = portfolio_data[0] if portfolio_data else {}

        # Performance metrics
        performance_query = """
            SELECT
                COUNT(*) as total_trades,
                AVG(CASE WHEN return_percent > 0 THEN 1.0 ELSE 0.0 END) * 100 as win_rate,
                AVG(return_percent) as avg_return,
                STDDEV(return_percent) as volatility,
                MIN(return_percent) as max_drawdown
            FROM experiments
            WHERE status = 'closed'
            AND exit_time >= CURRENT_DATE - INTERVAL '30 days'
        """
        performance_data = db_manager.execute_query(performance_query)
        performance = performance_data[0] if performance_data else {}

        # Recent activity
        recent_news = db_manager.execute_query(
            "SELECT * FROM news WHERE is_significant = true ORDER BY processed_at DESC LIMIT 10"
        )
        recent_signals = db_manager.execute_query(
            "SELECT * FROM signals ORDER BY created_at DESC LIMIT 10"
        )
        recent_experiments = db_manager.execute_query(
            "SELECT * FROM experiments ORDER BY entry_time DESC LIMIT 10"
        )

        return {
            "portfolio": {
                "total_value": portfolio.get('total_value', 10000.0),
                "cash_balance": portfolio.get('cash_balance', 5000.0),
                "positions_count": portfolio.get('positions_count', 0),
                "daily_pnl": portfolio.get('realized_pnl_today', 0.0),
                "total_return": portfolio.get('total_return', 0.0),
                "alpha_vs_sp500": portfolio.get('alpha_daily', 0.0)
            },
            "performance": {
                "win_rate": performance.get('win_rate', 0.0),
                "avg_return": performance.get('avg_return', 0.0),
                "sharpe_ratio": 0.0,  # Calculate if needed
                "max_drawdown": performance.get('max_drawdown', 0.0),
                "total_trades": performance.get('total_trades', 0)
            },
            "recent_activity": {
                "latest_news": recent_news,
                "latest_signals": recent_signals,
                "latest_experiments": recent_experiments
            }
        }
    except Exception as e:
        logger.error(f"Error getting dashboard metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/status")
async def get_system_status():
    """Get system status for all three blocks"""
    return {
        "news_analyzer": {
            "status": "running",
            "last_check": datetime.now().isoformat(),
            "news_processed_today": 45,
            "significant_news_today": 8
        },
        "signal_extractor": {
            "status": "running",
            "last_signal": datetime.now().isoformat(),
            "signals_generated_today": 12
        },
        "experiment_manager": {
            "status": "running",
            "active_positions": 3,
            "portfolio_value": 10456.0,
            "daily_pnl": 234.0
        }
    }

@app.get("/api/news")
async def get_news(limit: int = Query(50, le=100)):
    """Get recent news"""
    query = "SELECT * FROM news ORDER BY published_at DESC LIMIT %s"
    return db_manager.execute_query(query, (limit,))

@app.get("/api/news/significant")
async def get_significant_news(limit: int = Query(20, le=50)):
    """Get recent significant news"""
    query = "SELECT * FROM news WHERE is_significant = true ORDER BY published_at DESC LIMIT %s"
    return db_manager.execute_query(query, (limit,))

@app.get("/api/signals")
async def get_signals(limit: int = Query(50, le=100)):
    """Get recent signals"""
    query = "SELECT * FROM signals ORDER BY created_at DESC LIMIT %s"
    return db_manager.execute_query(query, (limit,))

@app.get("/api/signals/active")
async def get_active_signals():
    """Get active signals"""
    query = """
        SELECT s.* FROM signals s
        WHERE s.entry_start <= NOW() AND s.entry_end >= NOW()
        ORDER BY s.created_at DESC
    """
    return db_manager.execute_query(query)

@app.get("/api/experiments")
async def get_experiments(limit: int = Query(50, le=100)):
    """Get recent experiments"""
    query = "SELECT * FROM experiments ORDER BY entry_time DESC LIMIT %s"
    return db_manager.execute_query(query, (limit,))

@app.get("/api/experiments/active")
async def get_active_experiments():
    """Get active experiments"""
    query = "SELECT * FROM experiments WHERE status = 'active' ORDER BY entry_time DESC"
    return db_manager.execute_query(query)

@app.get("/api/experiments/closed")
async def get_closed_experiments(limit: int = Query(50, le=100)):
    """Get closed experiments"""
    query = "SELECT * FROM experiments WHERE status = 'closed' ORDER BY exit_time DESC LIMIT %s"
    return db_manager.execute_query(query, (limit,))

@app.get("/api/portfolio/snapshots")
async def get_portfolio_snapshots(hours: int = Query(24, le=168)):
    """Get portfolio snapshots for the last N hours"""
    query = """
        SELECT * FROM portfolio_snapshots
        WHERE timestamp >= NOW() - INTERVAL '%s hours'
        ORDER BY timestamp ASC
    """
    return db_manager.execute_query(query, (hours,))

@app.get("/api/portfolio/current")
async def get_current_portfolio():
    """Get current portfolio status"""
    query = "SELECT * FROM portfolio_snapshots ORDER BY timestamp DESC LIMIT 1"
    data = db_manager.execute_query(query)
    return data[0] if data else {}

@app.get("/api/performance/metrics")
async def get_performance_metrics(days: int = Query(30, le=365)):
    """Get performance metrics for the last N days"""
    query = """
        SELECT
            COUNT(*) as total_trades,
            SUM(CASE WHEN return_percent > 0 THEN 1 ELSE 0 END) as winning_trades,
            AVG(return_percent) as avg_return,
            STDDEV(return_percent) as volatility,
            SUM(net_pnl) as total_pnl,
            AVG(alpha) as avg_alpha
        FROM experiments
        WHERE status = 'closed'
        AND exit_time >= CURRENT_DATE - INTERVAL '%s days'
    """
    return db_manager.execute_query(query, (days,))

@app.get("/api/analysis/waves")
async def get_wave_analysis():
    """Get wave analysis distribution"""
    query = """
        SELECT
            wave,
            COUNT(*) as signal_count,
            AVG(confidence) as avg_confidence,
            AVG(expected_move_percent) as avg_expected_move
        FROM signals
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY wave
        ORDER BY wave
    """
    return db_manager.execute_query(query)

@app.get("/api/portfolio/pnl-history")
async def get_pnl_history(days: int = Query(30, le=365)):
    """Get P&L history for charts"""
    query = """
        SELECT
            DATE(exit_time) as date,
            SUM(net_pnl) as daily_pnl,
            COUNT(*) as trades_count
        FROM experiments
        WHERE status = 'closed'
        AND exit_time >= CURRENT_DATE - INTERVAL '%s days'
        GROUP BY DATE(exit_time)
        ORDER BY date
    """
    return db_manager.execute_query(query, (days,))

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message: {data}")

            # Echo back for now (in production, handle specific message types)
            await manager.send_personal_message(f"Message received: {data}", websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Background task for broadcasting updates
async def broadcast_updates():
    """Background task to broadcast real-time updates"""
    while True:
        try:
            if manager.active_connections:
                # Create a sample update message
                message = {
                    "type": "portfolio",
                    "data": {
                        "total_value": 10456.0,
                        "daily_pnl": 234.0,
                        "timestamp": datetime.now().isoformat()
                    },
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast(json.dumps(message))

            await asyncio.sleep(30)  # Broadcast every 30 seconds
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            await asyncio.sleep(5)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("WaveSens API Server starting up...")
    # Start background broadcasting task
    asyncio.create_task(broadcast_updates())

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Test database connection
        db_manager.execute_query("SELECT 1")
        return {"status": "healthy", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)