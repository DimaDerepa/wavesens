import React, { useState, useEffect } from 'react';
import { Card } from './Card';

interface HistoryPosition {
  id: number;
  ticker: string;
  signal_id: number;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  shares: number;
  stop_loss_price: number;
  take_profit_price: number;
  commission_paid: number;
  gross_pnl: number;
  net_pnl: number;
  return_percent: number;
  hold_duration: number;
  sp500_entry: number;
  sp500_exit: number;
  sp500_return: number;
  alpha: number;
  exit_reason: string;
  elliott_wave: number;
  signal_type: string;
  confidence: number;
  headline: string;
}

interface Props {
  apiBaseUrl: string;
}

export const PortfolioHistory: React.FC<Props> = ({ apiBaseUrl }) => {
  const [history, setHistory] = useState<HistoryPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'profit' | 'loss'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const loadHistory = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/positions/history?limit=100`);
      const data = await response.json();
      setHistory(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load portfolio history:', err);
      setLoading(false);
    }
  };

  const getPnLColor = (value: number) => {
    if (Math.abs(value) < 0.01) return '#94a3b8';
    return value >= 0 ? '#10b981' : '#ef4444';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const getWaveColor = (wave: number) => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280', '#ec4899'];
    return colors[wave] || '#6b7280';
  };

  const getExitReasonLabel = (reason: string) => {
    const labels: { [key: string]: string } = {
      'stop_loss': '🛑 Stop Loss',
      'take_profit': '🎯 Take Profit',
      'max_hold_expired': '⏰ Max Hold',
      'max_hold_expired_manual_close': '⏰ Manual Close (Expired)',
      'daily_loss_limit': '⚠️ Daily Loss Limit',
      'trailing_stop': '📉 Trailing Stop'
    };
    return labels[reason] || reason;
  };

  const filteredHistory = history.filter(pos => {
    if (filter === 'profit') return (pos.net_pnl || 0) > 0;
    if (filter === 'loss') return (pos.net_pnl || 0) < 0;
    return true;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate summary stats
  const totalTrades = filteredHistory.length;
  const profitableTrades = filteredHistory.filter(p => (p.net_pnl || 0) > 0).length;
  const totalPnL = filteredHistory.reduce((sum, p) => sum + (p.net_pnl || 0), 0);
  const avgReturn = filteredHistory.length > 0
    ? filteredHistory.reduce((sum, p) => sum + (p.return_percent || 0), 0) / filteredHistory.length
    : 0;
  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Portfolio History ({filteredHistory.length})</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                backgroundColor: filter === 'all' ? '#38bdf8' : 'rgba(71, 85, 105, 0.3)',
                color: filter === 'all' ? '#0f172a' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('profit')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                backgroundColor: filter === 'profit' ? '#10b981' : 'rgba(71, 85, 105, 0.3)',
                color: filter === 'profit' ? '#0f172a' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              Profit
            </button>
            <button
              onClick={() => setFilter('loss')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                backgroundColor: filter === 'loss' ? '#ef4444' : 'rgba(71, 85, 105, 0.3)',
                color: filter === 'loss' ? '#0f172a' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              Loss
            </button>
          </div>
        </div>
      }
      loading={loading}
    >
      <div>
        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.03) 100%)',
            border: '2px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '0.75rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600' }}>
              TOTAL TRADES
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#38bdf8' }}>
              {totalTrades}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.03) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '0.75rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600' }}>
              WIN RATE
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
              {winRate.toFixed(1)}%
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: `linear-gradient(135deg, ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} 0%, ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)'} 100%)`,
            border: `2px solid ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '0.75rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600' }}>
              TOTAL P&L
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: getPnLColor(totalPnL) }}>
              {formatCurrency(totalPnL)}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: `linear-gradient(135deg, ${avgReturn >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} 0%, ${avgReturn >= 0 ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)'} 100%)`,
            border: `2px solid ${avgReturn >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '0.75rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600' }}>
              AVG RETURN
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: getPnLColor(avgReturn) }}>
              {formatPercent(avgReturn)}
            </div>
          </div>
        </div>

        {/* History list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {paginatedHistory.length > 0 ? paginatedHistory.map((position) => {
            const isExpanded = expandedPosition === position.id;
            const pnlColor = getPnLColor(position.net_pnl || 0);

            return (
              <div
                key={position.id}
                style={{
                  border: `2px solid ${position.net_pnl >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  background: position.net_pnl >= 0
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.02) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Compact header */}
                <div
                  onClick={() => setExpandedPosition(isExpanded ? null : position.id)}
                  style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '100px 80px 120px 120px 120px 120px 1fr auto',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  {/* Ticker */}
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1.125rem', color: '#fff' }}>
                      {position.ticker}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ID {position.id}
                    </div>
                  </div>

                  {/* Wave */}
                  <div style={{
                    padding: '0.375rem 0.5rem',
                    borderRadius: '0.375rem',
                    backgroundColor: getWaveColor(position.elliott_wave),
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textAlign: 'center'
                  }}>
                    W{position.elliott_wave}
                  </div>

                  {/* Entry */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.125rem' }}>
                      Entry
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#cbd5e1' }}>
                      {formatCurrency(position.entry_price)}
                    </div>
                  </div>

                  {/* Exit */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.125rem' }}>
                      Exit
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#cbd5e1' }}>
                      {formatCurrency(position.exit_price)}
                    </div>
                  </div>

                  {/* P&L $ */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.125rem' }}>
                      P&L
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: pnlColor }}>
                      {formatCurrency(position.net_pnl)}
                    </div>
                  </div>

                  {/* Return % */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.125rem' }}>
                      Return
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: pnlColor }}>
                      {formatPercent(position.return_percent)}
                    </div>
                  </div>

                  {/* Alpha */}
                  {position.alpha !== null && position.alpha !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.125rem' }}>
                        Alpha
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: getPnLColor(position.alpha) }}>
                        {formatPercent(position.alpha)}
                      </div>
                    </div>
                  )}

                  {/* Expand icon */}
                  <div style={{ color: '#64748b', fontSize: '1rem' }}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: '1.25rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderTop: '1px solid rgba(71, 85, 105, 0.3)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                      {/* Timing */}
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#94a3b8',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          marginBottom: '0.75rem'
                        }}>
                          ⏱️ Timing
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.8' }}>
                          <div><strong>Entry:</strong> {formatDateTime(position.entry_time)}</div>
                          <div><strong>Exit:</strong> {formatDateTime(position.exit_time)}</div>
                          <div><strong>Duration:</strong> {formatDuration(position.hold_duration)}</div>
                          <div><strong>Reason:</strong> {getExitReasonLabel(position.exit_reason)}</div>
                        </div>
                      </div>

                      {/* Risk Management */}
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#94a3b8',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          marginBottom: '0.75rem'
                        }}>
                          🎯 Risk Levels
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.8' }}>
                          <div><strong>Stop Loss:</strong> {formatCurrency(position.stop_loss_price)}</div>
                          <div><strong>Take Profit:</strong> {formatCurrency(position.take_profit_price)}</div>
                          <div><strong>Position Size:</strong> {formatCurrency(position.position_size)}</div>
                          <div><strong>Shares:</strong> {position.shares.toFixed(4)}</div>
                          <div><strong>Commission:</strong> {formatCurrency(position.commission_paid)}</div>
                        </div>
                      </div>

                      {/* Benchmark Comparison */}
                      {position.sp500_entry && position.sp500_exit && (
                        <div>
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#94a3b8',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '0.75rem'
                          }}>
                            📊 vs S&P 500
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.8' }}>
                            <div><strong>SPY Entry:</strong> {formatCurrency(position.sp500_entry)}</div>
                            <div><strong>SPY Exit:</strong> {formatCurrency(position.sp500_exit)}</div>
                            <div><strong>SPY Return:</strong> {formatPercent(position.sp500_return || 0)}</div>
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '0.375rem' }}>
                              <strong style={{ color: getPnLColor(position.alpha) }}>
                                Alpha: {formatPercent(position.alpha || 0)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* News Headline */}
                    {position.headline && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#94a3b8',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          marginBottom: '0.5rem'
                        }}>
                          📰 News Source
                        </div>
                        <div style={{ fontSize: '0.9375rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                          {position.headline}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div style={{
              textAlign: 'center',
              padding: '4rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '0.75rem',
              border: '2px dashed rgba(71, 85, 105, 0.3)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                📜
              </div>
              <div style={{ color: '#64748b', fontSize: '1.125rem', fontWeight: '500' }}>
                No trading history
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(71, 85, 105, 0.3)'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === 1 ? 'rgba(71, 85, 105, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                color: currentPage === 1 ? '#64748b' : '#38bdf8',
                transition: 'all 0.2s'
              }}
            >
              ← Previous
            </button>

            <div style={{ color: '#cbd5e1', fontSize: '0.875rem', fontWeight: '600' }}>
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === totalPages ? 'rgba(71, 85, 105, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                color: currentPage === totalPages ? '#64748b' : '#38bdf8',
                transition: 'all 0.2s'
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};
