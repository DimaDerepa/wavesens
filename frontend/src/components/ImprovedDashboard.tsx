import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from './Card';
import { MetricCard } from './MetricCard';
import { ActivePositions } from './ActivePositions';
import { SignalsWithReasoning } from './SignalsWithReasoning';
import { ServiceLogs } from './ServiceLogs';
import { ElliottWaveChart } from './ElliottWaveChart';
import { apiService, API_BASE_URL } from '../services/api';
import { DashboardMetrics } from '../types';

const ImprovedDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'signals' | 'logs'>('positions');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardMetrics, portfolioSnapshots] = await Promise.all([
        apiService.getDashboardMetrics(),
        apiService.getPortfolioSnapshots(24)
      ]);

      setMetrics(dashboardMetrics);
      setPortfolioData(portfolioSnapshots.map((snap: any) => ({
        time: new Date(snap.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        portfolio: snap.total_value,
        cash: snap.cash_balance
      })));
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Sticky Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                🌊 WaveSens Trading
              </h1>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Elliott Wave Analysis Platform
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Key Metrics - More compact */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <MetricCard
            title="Portfolio"
            value={formatCurrency(metrics?.portfolio.total_value || 0)}
            subtitle={`${metrics?.portfolio.positions_count || 0} positions`}
            trend={metrics?.portfolio.total_return && metrics.portfolio.total_return >= 0 ? 'up' : 'down'}
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
            title="Alpha vs S&P"
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

        {/* Main Content - 2 column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Portfolio Chart */}
          <Card title="Portfolio Value (24h)" loading={loading}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={portfolioData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="time"
                  style={{ fontSize: '0.75rem', fill: '#6b7280' }}
                  tick={{ dy: 5 }}
                />
                <YAxis
                  style={{ fontSize: '0.75rem', fill: '#6b7280' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.875rem' }} />
                <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={2} name="Portfolio" dot={false} />
                <Line type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={2} name="Cash" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Elliott Wave Distribution */}
          <ElliottWaveChart apiBaseUrl={API_BASE_URL} />
        </div>

        {/* Tabbed Content Area */}
        <div style={{ marginBottom: '1.5rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
            <button
              onClick={() => setActiveTab('positions')}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'positions' ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: activeTab === 'positions' ? '#3b82f6' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              📊 Active Positions
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'signals' ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: activeTab === 'signals' ? '#3b82f6' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              🌊 Trading Signals
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'logs' ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: activeTab === 'logs' ? '#3b82f6' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              📝 Service Logs
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'positions' && (
              <ActivePositions apiBaseUrl={API_BASE_URL} />
            )}
            {activeTab === 'signals' && (
              <SignalsWithReasoning apiBaseUrl={API_BASE_URL} />
            )}
            {activeTab === 'logs' && (
              <ServiceLogs apiBaseUrl={API_BASE_URL} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          fontSize: '0.75rem',
          color: '#9ca3af'
        }}>
          WaveSens Trading Platform • Elliott Wave Analysis • Real-time Data from PostgreSQL
        </div>
      </div>
    </div>
  );
};

export default ImprovedDashboard;
