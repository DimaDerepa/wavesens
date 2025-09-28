import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from './Card';
import { MetricCard } from './MetricCard';
import { apiService } from '../services/api';
import { webSocketService } from '../services/websocket';
import { DashboardMetrics, NewsItem, Signal, Experiment } from '../types';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [waveAnalysis, setWaveAnalysis] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
    setupWebSocket();

    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboardData = async () => {
    try {
      console.log('📊 Loading dashboard data...');
      setLoading(true);
      const [dashboardMetrics, portfolioSnapshots, waveData] = await Promise.all([
        apiService.getDashboardMetrics(),
        apiService.getPortfolioSnapshots(24),
        apiService.getWaveAnalysis()
      ]);

      setMetrics(dashboardMetrics);
      setWaveAnalysis(waveData);
      setPortfolioData(portfolioSnapshots.map(snap => ({
        time: new Date(snap.timestamp).toLocaleTimeString(),
        portfolio: snap.total_value,
        sp500: snap.sp500_value,
        alpha: snap.alpha
      })));
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('❌ Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = async () => {
    try {
      await webSocketService.connect();
      setConnectionStatus(webSocketService.getConnectionState());

      webSocketService.subscribe('portfolio', (data) => {
        if (metrics) {
          setMetrics(prev => prev ? {
            ...prev,
            portfolio: { ...prev.portfolio, ...data }
          } : prev);
        }
      });

      webSocketService.subscribe('experiment', () => {
        loadDashboardData();
      });

    } catch (err) {
      console.error('WebSocket connection failed:', err);
      setConnectionStatus('ERROR');
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const getWaveColor = (wave: number) => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];
    return colors[wave % colors.length];
  };

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '2px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '0.5rem' }}>⚠️ Error</div>
          <div style={{ color: '#6b7280' }}>{error}</div>
          <button
            onClick={loadDashboardData}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>🌊 WaveSens Dashboard</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: connectionStatus === 'OPEN' ? '#dcfce7' : connectionStatus === 'CONNECTING' ? '#fef3c7' : '#fee2e2',
                color: connectionStatus === 'OPEN' ? '#166534' : connectionStatus === 'CONNECTING' ? '#92400e' : '#991b1b'
              }}>
                {connectionStatus === 'OPEN' ? '🟢 Live' :
                 connectionStatus === 'CONNECTING' ? '🟡 Connecting' : '🔴 Offline'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <MetricCard
            title="Portfolio Value"
            value={formatCurrency(metrics?.portfolio.total_value || 0)}
            subtitle={`${metrics?.portfolio.positions_count || 0} positions`}
            trend={metrics?.portfolio.daily_pnl && metrics.portfolio.daily_pnl >= 0 ? 'up' : 'down'}
            trendValue={formatPercent(metrics?.portfolio.total_return || 0)}
            icon="💰"
          />
          <MetricCard
            title="Daily P&L"
            value={formatCurrency(metrics?.portfolio.daily_pnl || 0)}
            trend={metrics?.portfolio.daily_pnl && metrics.portfolio.daily_pnl >= 0 ? 'up' : 'down'}
            trendValue={formatCurrency(Math.abs(metrics?.portfolio.daily_pnl || 0))}
            icon="📈"
          />
          <MetricCard
            title="Alpha vs S&P 500"
            value={formatPercent(metrics?.portfolio.alpha_vs_sp500 || 0)}
            trend={metrics?.portfolio.alpha_vs_sp500 && metrics.portfolio.alpha_vs_sp500 >= 0 ? 'up' : 'down'}
            trendValue={formatPercent(Math.abs(metrics?.portfolio.alpha_vs_sp500 || 0))}
            icon="🎯"
          />
          <MetricCard
            title="Win Rate"
            value={formatPercent(metrics?.performance.win_rate || 0)}
            subtitle={`${metrics?.performance.total_trades || 0} trades`}
            trend={metrics?.performance.win_rate && metrics.performance.win_rate >= 50 ? 'up' : 'down'}
            trendValue={`${metrics?.performance.total_trades || 0} total`}
            icon="🏆"
          />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Portfolio Performance Chart */}
          <Card title="Portfolio Performance (24h)" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={portfolioData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} name="Portfolio" />
                <Line type="monotone" dataKey="sp500" stroke="#6b7280" strokeWidth={2} name="S&P 500" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Wave Analysis */}
          <Card title="Wave Analysis Distribution" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1, 2, 3, 4, 5, 6].map(wave => (
                <div key={wave} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '4rem', fontSize: '0.875rem', fontWeight: '500' }}>Wave {wave}</div>
                  <div style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '0.5rem', margin: '0 0.75rem' }}>
                    <div
                      style={{
                        height: '0.5rem',
                        borderRadius: '9999px',
                        width: `${waveAnalysis?.[wave]?.percentage || 0}%`,
                        backgroundColor: getWaveColor(wave)
                      }}
                    />
                  </div>
                  <div style={{ width: '3rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {waveAnalysis?.[wave]?.count || 0}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity Tables */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Latest News */}
          <Card title="Latest Significant News" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '20rem', overflowY: 'auto' }}>
              {metrics?.recent_activity.latest_news.slice(0, 5).map((news: NewsItem) => (
                <div key={news.id} style={{ borderLeft: '4px solid #3b82f6', paddingLeft: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', lineHeight: '1.25' }}>
                    {news.headline}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {new Date(news.published_at).toLocaleString()} • Score: {news.significance_score}
                  </div>
                </div>
              )) || <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No recent news</div>}
            </div>
          </Card>

          {/* Latest Signals */}
          <Card title="Latest Trading Signals" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '20rem', overflowY: 'auto' }}>
              {metrics?.recent_activity.latest_signals.slice(0, 5).map((signal: Signal) => (
                <div key={signal.id} style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.75rem', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '500' }}>{signal.ticker}</span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      backgroundColor: signal.action === 'BUY' ? '#dcfce7' : signal.action === 'SELL' ? '#fee2e2' : '#fef3c7',
                      color: signal.action === 'BUY' ? '#166534' : signal.action === 'SELL' ? '#991b1b' : '#92400e'
                    }}>
                      {signal.action}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Wave {signal.wave} • {signal.confidence}% confidence
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {new Date(signal.created_at).toLocaleString()}
                  </div>
                </div>
              )) || <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No recent signals</div>}
            </div>
          </Card>

          {/* Active Positions */}
          <Card title="Active Positions" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '20rem', overflowY: 'auto' }}>
              {metrics?.recent_activity.latest_experiments
                .filter((exp: Experiment) => exp.status === 'active')
                .slice(0, 5)
                .map((experiment: Experiment) => (
                <div key={experiment.id} style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.75rem', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '500' }}>{experiment.ticker}</span>
                    <span style={{
                      fontSize: '0.875rem',
                      color: experiment.return_percent && experiment.return_percent >= 0 ? '#059669' : '#dc2626'
                    }}>
                      {experiment.return_percent ? formatPercent(experiment.return_percent) : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {formatCurrency(experiment.position_size)} • {experiment.shares} shares
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Entry: {formatCurrency(experiment.entry_price)}
                  </div>
                </div>
              )) || <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No active positions</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;