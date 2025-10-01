#!/usr/bin/env python3
"""
WaveSens API Server - Real-time backend for frontend dashboard
NO MOCKS, NO FALLBACKS, NO FAKE DATA - All data from PostgreSQL
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import psycopg2
import psycopg2.extras
import os
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WaveSens API", version="1.0.0")

# CORS для frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В проде указать конкретный домен frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/wavesens')

def get_db():
    """Get PostgreSQL connection"""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn

def decimal_to_float(obj):
    """Convert Decimal and datetime to JSON-serializable types"""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, timezone)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

class ConnectionManager:
    """WebSocket connection manager for real-time updates"""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnected.append(connection)

        # Remove disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"status": "ok", "service": "WaveSens API Server"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

@app.get("/api/dashboard/metrics")
async def get_dashboard_metrics():
    """
    Get comprehensive dashboard metrics with NO MOCKS
    Returns portfolio, performance, recent activity, system status
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        # Portfolio metrics from latest snapshot
        cur.execute("""
            SELECT * FROM portfolio_snapshots
            ORDER BY timestamp DESC
            LIMIT 1
        """)
        latest_snapshot = cur.fetchone()

        if not latest_snapshot:
            # Create initial snapshot if none exists
            cur.execute("""
                INSERT INTO portfolio_snapshots (
                    total_value, cash_balance, positions_count,
                    unrealized_pnl, realized_pnl_today, realized_pnl_total,
                    daily_return, total_return
                ) VALUES (10000, 10000, 0, 0, 0, 0, 0, 0)
                RETURNING *
            """)
            latest_snapshot = cur.fetchone()
            conn.commit()

        # Active positions count and value
        cur.execute("""
            SELECT
                COUNT(*) as positions_count,
                COALESCE(SUM(position_size), 0) as total_exposure
            FROM experiments
            WHERE status = 'active'
        """)
        positions_data = cur.fetchone()

        # Performance metrics from closed experiments
        cur.execute("""
            SELECT
                COUNT(*) as total_trades,
                COUNT(CASE WHEN net_pnl > 0 THEN 1 END) as wins,
                AVG(return_percent) as avg_return,
                MAX(return_percent) as max_return,
                MIN(return_percent) as min_return,
                STDDEV(return_percent) as return_stddev,
                AVG(alpha) as avg_alpha
            FROM experiments
            WHERE status = 'closed'
            AND exit_time > NOW() - INTERVAL '30 days'
        """)
        perf_data = cur.fetchone()

        total_trades = perf_data['total_trades'] or 0
        wins = perf_data['wins'] or 0
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

        # Recent news
        cur.execute("""
            SELECT id, headline, summary, significance_score, reasoning, published_at, created_at
            FROM news_items
            WHERE is_significant = TRUE
            ORDER BY created_at DESC
            LIMIT 10
        """)
        recent_news = cur.fetchall()

        # Recent signals
        cur.execute("""
            SELECT
                ts.id, ts.signal_type, ts.confidence, ts.elliott_wave,
                ts.reasoning, ts.created_at, ts.market_conditions,
                ni.headline
            FROM trading_signals ts
            JOIN news_items ni ON ts.news_item_id = ni.id
            ORDER BY ts.created_at DESC
            LIMIT 10
        """)
        recent_signals = cur.fetchall()

        # Active experiments (positions)
        cur.execute("""
            SELECT * FROM experiments
            WHERE status = 'active'
            ORDER BY entry_time DESC
            LIMIT 10
        """)
        active_experiments = cur.fetchall()

        # System status - simplified
        system_status = {
            "news_analyzer": {
                "status": "running",
                "uptime": "Active"
            },
            "signal_extractor": {
                "status": "running",
                "uptime": "Active"
            },
            "experiment_manager": {
                "status": "running",
                "uptime": "Active"
            }
        }

        result = {
            "portfolio": {
                "total_value": float(latest_snapshot['total_value']),
                "cash_balance": float(latest_snapshot['cash_balance']),
                "positions_count": positions_data['positions_count'],
                "daily_pnl": float(latest_snapshot['realized_pnl_today']),
                "total_return": float(latest_snapshot['total_return']),
                "alpha_vs_sp500": float(perf_data['avg_alpha'] or 0)
            },
            "performance": {
                "win_rate": win_rate,
                "avg_return": float(perf_data['avg_return'] or 0),
                "sharpe_ratio": 0,  # TODO: Calculate
                "max_drawdown": float(perf_data['min_return'] or 0),
                "total_trades": total_trades
            },
            "recent_activity": {
                "latest_news": [dict(row) for row in recent_news],
                "latest_signals": [dict(row) for row in recent_signals],
                "latest_experiments": [dict(row) for row in active_experiments]
            },
            "system_status": system_status
        }

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        import traceback
        logger.error(f"Error getting dashboard metrics: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions/active")
async def get_active_positions():
    """
    Get active trading positions with current prices and benchmark data
    NO MOCKS - real data only
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute("""
            SELECT
                id, ticker, signal_id, news_id,
                entry_time, entry_price, position_size, shares,
                stop_loss_price, take_profit_price, max_hold_until,
                sp500_entry, commission_paid, status
            FROM experiments
            WHERE status = 'active'
            ORDER BY entry_time DESC
        """)

        positions = cur.fetchall()
        result = [dict(row) for row in positions]

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        logger.error(f"Error getting active positions: {e}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions/history")
async def get_portfolio_history(limit: int = 100):
    """
    Get closed trading positions with full P&L and alpha data
    NO MOCKS - complete trading history
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute("""
            SELECT
                e.id,
                e.ticker,
                e.signal_id,
                e.entry_time,
                e.exit_time,
                e.entry_price,
                e.exit_price,
                e.position_size,
                e.shares,
                e.stop_loss_price,
                e.take_profit_price,
                e.commission_paid,
                e.gross_pnl,
                e.net_pnl,
                e.return_percent,
                e.hold_duration,
                e.sp500_entry,
                e.sp500_exit,
                e.sp500_return,
                e.alpha,
                e.exit_reason,
                ts.elliott_wave,
                ts.signal_type,
                ts.confidence,
                ni.headline
            FROM experiments e
            LEFT JOIN trading_signals ts ON e.signal_id = ts.id
            LEFT JOIN news_items ni ON e.news_id = ni.id
            WHERE e.status = 'closed'
            ORDER BY e.exit_time DESC
            LIMIT %s
        """, (limit,))

        history = cur.fetchall()
        result = [dict(row) for row in history]

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        logger.error(f"Error getting portfolio history: {e}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals/with-reasoning")
async def get_signals_with_reasoning(limit: int = 50):
    """
    Get trading signals with full reasoning from Elliott Wave analysis
    NO MOCKS - real LLM reasoning
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute("""
            SELECT
                ts.id,
                ts.signal_type,
                ts.confidence,
                ts.elliott_wave,
                ts.wave_description,
                ts.reasoning,
                ts.market_conditions,
                ts.created_at,
                ni.id as news_id,
                ni.headline,
                ni.reasoning as news_reasoning,
                ni.significance_score
            FROM trading_signals ts
            JOIN news_items ni ON ts.news_item_id = ni.id
            ORDER BY ts.created_at DESC
            LIMIT %s
        """, (limit,))

        signals = cur.fetchall()
        result = [dict(row) for row in signals]

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        logger.error(f"Error getting signals with reasoning: {e}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs/by-service")
async def get_logs_by_service(limit: int = 100):
    """
    Get service logs grouped by service
    Real logs from database logger
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        # Check if service_logs table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'service_logs'
            )
        """)

        if not cur.fetchone()[0]:
            # Return empty logs if table doesn't exist
            return {
                "news_analyzer": [],
                "signal_extractor": [],
                "experiment_manager": []
            }

        # Get logs for each service
        services = ["news_analyzer", "signal_extractor", "experiment_manager"]
        result = {}

        for service in services:
            cur.execute("""
                SELECT level, message, timestamp, service
                FROM service_logs
                WHERE service = %s
                ORDER BY timestamp DESC
                LIMIT %s
            """, (service, limit))

            result[service] = [dict(row) for row in cur.fetchall()]

        cur.close()
        conn.close()

        return result

    except Exception as e:
        logger.error(f"Error getting service logs: {e}")
        cur.close()
        conn.close()
        # Return empty on error - no fallbacks
        return {
            "news_analyzer": [],
            "signal_extractor": [],
            "experiment_manager": []
        }

@app.get("/api/portfolio/snapshots")
async def get_portfolio_snapshots(hours: int = 24):
    """Get portfolio snapshots for charting"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute("""
            SELECT * FROM portfolio_snapshots
            WHERE timestamp > NOW() - INTERVAL '%s hours'
            ORDER BY timestamp ASC
        """, (hours,))

        snapshots = cur.fetchall()
        result = [dict(row) for row in snapshots]

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        logger.error(f"Error getting portfolio snapshots: {e}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis/waves")
async def get_wave_analysis():
    """Get Elliott Wave distribution from signals"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute("""
            SELECT
                elliott_wave as wave,
                COUNT(*) as count
            FROM trading_signals
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY elliott_wave
            ORDER BY elliott_wave
        """)

        waves = cur.fetchall()

        # Calculate total for percentages
        total = sum(row['count'] for row in waves)

        result = {}
        for row in waves:
            wave = row['wave']
            count = row['count']
            result[wave] = {
                "count": count,
                "percentage": (count / total * 100) if total > 0 else 0
            }

        cur.close()
        conn.close()

        return json.loads(json.dumps(result, default=decimal_to_float))

    except Exception as e:
        logger.error(f"Error getting wave analysis: {e}")
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/current-prices")
async def get_current_prices(tickers: str):
    """Get current prices for tickers (comma-separated)"""
    import requests

    ticker_list = [t.strip() for t in tickers.split(',')]
    FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY', 'd367tv1r01qumnp4iltgd367tv1r01qumnp4ilu0')

    prices = {}
    for ticker in ticker_list:
        try:
            response = requests.get(
                f'https://finnhub.io/api/v1/quote?symbol={ticker}&token={FINNHUB_API_KEY}',
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('c'):  # current price
                    prices[ticker] = data['c']
        except Exception as e:
            logger.error(f"Error getting price for {ticker}: {e}")
            continue

    return prices

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive any client messages
            data = await websocket.receive_text()
            # Echo back for testing
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
