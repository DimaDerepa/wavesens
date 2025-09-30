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
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.1) 0%, transparent 50%)' }}>
      {/* Sticky Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)'
      }}>
        <div style={{ maxWidth: '95rem', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#38bdf8', margin: 0, letterSpacing: '-0.025em' }}>
                🌊 WaveSens
              </h1>
              <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                Elliott Wave Trading Platform
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: '500' }}>
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
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid rgba(51, 65, 85, 0.5)' }}>
            <button
              onClick={() => setActiveTab('positions')}
              style={{
                padding: '1rem 2rem',
                fontSize: '0.9375rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'positions' ? '3px solid #38bdf8' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'positions' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: activeTab === 'positions' ? '#38bdf8' : '#64748b',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0'
              }}
            >
              📊 Active Positions
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              style={{
                padding: '1rem 2rem',
                fontSize: '0.9375rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'signals' ? '3px solid #38bdf8' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'signals' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: activeTab === 'signals' ? '#38bdf8' : '#64748b',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0'
              }}
            >
              🌊 Trading Signals
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '1rem 2rem',
                fontSize: '0.9375rem',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'logs' ? '3px solid #38bdf8' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                backgroundColor: activeTab === 'logs' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                color: activeTab === 'logs' ? '#38bdf8' : '#64748b',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0'
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
          padding: '2rem',
          fontSize: '0.8125rem',
          color: '#475569',
          borderTop: '1px solid rgba(51, 65, 85, 0.5)',
          marginTop: '3rem'
        }}>
          <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '0.5rem' }}>
            WaveSens Trading Platform
          </div>
          <div>
            Elliott Wave Analysis • Real-time Data from PostgreSQL • No Mocks, No Fallbacks
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedDashboard;
