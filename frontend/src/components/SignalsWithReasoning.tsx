import React, { useState, useEffect } from 'react';
import { Card } from './Card';

interface Signal {
  id: number;
  signal_type: string;
  confidence: number;
  elliott_wave: number;
  wave_description: string;
  reasoning: string;
  market_conditions: {
    ticker: string;
    expected_move: number;
  };
  created_at: string;
  headline: string;
  news_reasoning: string;
  significance_score: number;
}

interface Props {
  apiBaseUrl: string;
}

export const SignalsWithReasoning: React.FC<Props> = ({ apiBaseUrl }) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all');

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const loadSignals = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/signals/with-reasoning?limit=50`);
      const data = await response.json();
      setSignals(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load signals:', err);
      setLoading(false);
    }
  };

  const getWaveColor = (wave: number) => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280', '#ec4899'];
    return colors[wave] || '#6b7280';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSignals = filter === 'all'
    ? signals
    : signals.filter(s => s.signal_type === filter);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Trading Signals ({filteredSignals.length})</span>
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
              onClick={() => setFilter('BUY')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                backgroundColor: filter === 'BUY' ? '#10b981' : 'rgba(71, 85, 105, 0.3)',
                color: filter === 'BUY' ? '#0f172a' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              BUY
            </button>
            <button
              onClick={() => setFilter('SELL')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                backgroundColor: filter === 'SELL' ? '#ef4444' : 'rgba(71, 85, 105, 0.3)',
                color: filter === 'SELL' ? '#0f172a' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              SELL
            </button>
          </div>
        </div>
      }
      loading={loading}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
        {filteredSignals.length > 0 ? filteredSignals.map((signal) => {
          const isExpanded = expandedSignal === signal.id;
          const ticker = signal.market_conditions?.ticker || 'N/A';

          return (
            <div
              key={signal.id}
              style={{
                border: signal.signal_type === 'BUY'
                  ? '2px solid rgba(16, 185, 129, 0.3)'
                  : '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                background: signal.signal_type === 'BUY'
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.03) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.03) 100%)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Compact header */}
              <div
                onClick={() => setExpandedSignal(isExpanded ? null : signal.id)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {/* Ticker & Action */}
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.125rem', color: '#fff' }}>{ticker}</div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: signal.signal_type === 'BUY' ? '#10b981' : '#ef4444',
                      fontWeight: '700'
                    }}>
                      {signal.signal_type}
                    </div>
                  </div>

                  {/* Wave */}
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: getWaveColor(signal.elliott_wave),
                    color: '#fff',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    minWidth: '90px',
                    textAlign: 'center'
                  }}>
                    Wave {signal.elliott_wave}
                  </div>

                  {/* Confidence */}
                  <div style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: '600' }}>
                    {(signal.confidence * 100).toFixed(0)}% conf
                  </div>

                  {/* Expected move */}
                  {signal.market_conditions?.expected_move && (
                    <div style={{ fontSize: '1rem', color: '#38bdf8', fontWeight: '700' }}>
                      {signal.market_conditions.expected_move > 0 ? '+' : ''}
                      {signal.market_conditions.expected_move.toFixed(1)}%
                    </div>
                  )}

                  {/* Time */}
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginLeft: 'auto', fontWeight: '500' }}>
                    {formatTime(signal.created_at)}
                  </div>

                  {/* Expand icon */}
                  <div style={{ color: '#64748b', fontSize: '1.25rem' }}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  {/* News Headline */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                      📰 News Source
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                      {signal.headline}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                      Significance Score: {signal.significance_score}
                    </div>
                  </div>

                  {/* Wave Analysis Reasoning */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ fontSize: '0.875rem', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                      🌊 Elliott Wave Analysis
                    </div>
                    <div style={{ fontSize: '0.9375rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#e2e8f0' }}>
                        {signal.wave_description}
                      </div>
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '0.5rem',
                        fontSize: '0.9375rem',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6',
                        border: '1px solid rgba(71, 85, 105, 0.3)'
                      }}>
                        {signal.reasoning}
                      </div>
                    </div>
                  </div>

                  {/* News Reasoning */}
                  {signal.news_reasoning && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                        💡 News Impact Analysis
                      </div>
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '0.5rem',
                        fontSize: '0.9375rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        color: '#a7f3d0',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        {signal.news_reasoning}
                      </div>
                    </div>
                  )}

                  {/* Market Conditions */}
                  {signal.market_conditions && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                        📊 Market Context
                      </div>
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '0.5rem',
                        fontSize: '0.8125rem',
                        fontFamily: 'Monaco, Consolas, monospace',
                        color: '#94a3b8',
                        border: '1px solid rgba(71, 85, 105, 0.3)'
                      }}>
                        {JSON.stringify(signal.market_conditions, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', fontSize: '1.125rem', fontWeight: '500' }}>
            No {filter !== 'all' ? filter : ''} signals
          </div>
        )}
      </div>
    </Card>
  );
};
