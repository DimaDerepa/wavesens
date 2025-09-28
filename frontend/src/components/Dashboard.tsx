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
  const [realLogs, setRealLogs] = useState<any>(null);
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const [isWeekend, setIsWeekend] = useState(false);

  useEffect(() => {
    loadDashboardData();
    setupWebSocket();
    checkWeekend();

    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkWeekend = () => {
    const now = new Date();
    const day = now.getDay();
    setIsWeekend(day === 0 || day === 6); // Sunday = 0, Saturday = 6
  };

  const handleModelChange = async (modelId: string) => {
    try {
      await apiService.changeModel(modelId);
      // Reload data to get updated model info
      loadDashboardData();
    } catch (err) {
      console.error('Failed to change model:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('📊 Loading dashboard data...');
      setLoading(true);
      const [dashboardMetrics, portfolioSnapshots, waveData, tokensData, realLogsData] = await Promise.all([
        apiService.getDashboardMetrics(),
        apiService.getPortfolioSnapshots(24),
        apiService.getWaveAnalysis(),
        apiService.getTokenUsage(),
        apiService.getSystemLogs()
      ]);

      setMetrics(dashboardMetrics);
      setWaveAnalysis(waveData);
      setTokenUsage(tokensData);
      setRealLogs(realLogsData);
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

      {/* Weekend Banner */}
      {isWeekend && (
        <div style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.5rem',
            color: '#92400e',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📅 <strong>Weekend Mode:</strong> Markets are closed. News analysis is running in limited mode to save tokens.
          </div>
        </div>
      )}

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

        {/* System Status & Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
          {/* Service Status */}
          <Card title="Service Status & Uptime" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {metrics?.system_status && Object.entries(metrics.system_status)
                .filter(([service, status]) => typeof status === 'object' && status.uptime && status.status)
                .map(([service, status]: [string, any]) => (
                <div key={service} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
                  <div>
                    <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{service.replace('_', ' ')}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Uptime: {status.uptime || 'Unknown'}</div>
                  </div>
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    backgroundColor: status.status === 'running' ? '#dcfce7' : '#fee2e2',
                    color: status.status === 'running' ? '#166534' : '#991b1b'
                  }}>
                    {status.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Token Usage */}
          <Card title="OpenRouter Usage & Costs" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tokenUsage && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.375rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0284c7' }}>
                        {tokenUsage.tokens_today?.toLocaleString() || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Tokens Today</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '0.375rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#059669' }}>
                        ${tokenUsage.cost_today_usd?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Cost Today</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                    Total: {tokenUsage.total_tokens_used?.toLocaleString() || 0} tokens • ${tokenUsage.total_cost_usd?.toFixed(2) || '0.00'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                    Current Model: {tokenUsage.current_model || 'Unknown'}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Model Selection */}
          <Card title="Model Selection" loading={loading}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tokenUsage?.available_models?.map((model: any) => (
                <div
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  style={{
                    padding: '0.75rem',
                    border: tokenUsage.current_model === model.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    backgroundColor: tokenUsage.current_model === model.id ? '#eff6ff' : '#ffffff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{model.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    ${model.cost_per_1k}/1k tokens
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Real Service Logs */}
        <div style={{ marginTop: '2rem' }}>
          <Card title="Real Service Logs" loading={loading}>
            {realLogs ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {Object.entries(realLogs).map(([service, logs]: [string, any]) => (
                  <div key={service}>
                    <h4 style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      marginBottom: '0.75rem',
                      textTransform: 'capitalize',
                      color: '#374151'
                    }}>
                      {service.replace('_', ' ')}
                    </h4>
                    <div style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      fontSize: '0.75rem',
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                    }}>
                      {logs && logs.length > 0 ? (
                        logs.slice(0, 15).map((log: any, index: number) => (
                          <div key={index} style={{
                            marginBottom: '0.5rem',
                            lineHeight: '1.3',
                            color: '#e5e7eb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                color: log.level === 'ERROR' ? '#f87171' :
                                       log.level === 'WARN' ? '#fbbf24' :
                                       log.level === 'INFO' ? '#34d399' : '#60a5fa',
                                fontWeight: '600'
                              }}>
                                [{log.level}]
                              </span>
                              <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div style={{
                              marginTop: '0.25rem',
                              paddingLeft: '0.5rem',
                              borderLeft: '2px solid #374151',
                              color: '#f3f4f6',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {log.message}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{
                          color: '#9ca3af',
                          textAlign: 'center',
                          padding: '2rem',
                          fontStyle: 'italic'
                        }}>
                          No recent logs available
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Loading real service logs...
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;