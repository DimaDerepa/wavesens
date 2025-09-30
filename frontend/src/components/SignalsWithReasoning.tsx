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
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                backgroundColor: filter === 'all' ? '#3b82f6' : '#e5e7eb',
                color: filter === 'all' ? '#fff' : '#6b7280'
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('BUY')}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                backgroundColor: filter === 'BUY' ? '#10b981' : '#e5e7eb',
                color: filter === 'BUY' ? '#fff' : '#6b7280'
              }}
            >
              BUY
            </button>
            <button
              onClick={() => setFilter('SELL')}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                backgroundColor: filter === 'SELL' ? '#ef4444' : '#e5e7eb',
                color: filter === 'SELL' ? '#fff' : '#6b7280'
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
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                backgroundColor: '#fff'
              }}
            >
              {/* Compact header */}
              <div
                onClick={() => setExpandedSignal(isExpanded ? null : signal.id)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {/* Ticker & Action */}
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{ticker}</div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: signal.signal_type === 'BUY' ? '#059669' : '#dc2626',
                      fontWeight: '600'
                    }}>
                      {signal.signal_type}
                    </div>
                  </div>

                  {/* Wave */}
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    backgroundColor: getWaveColor(signal.elliott_wave),
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    minWidth: '70px',
                    textAlign: 'center'
                  }}>
                    Wave {signal.elliott_wave}
                  </div>

                  {/* Confidence */}
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {(signal.confidence * 100).toFixed(0)}% confidence
                  </div>

                  {/* Expected move */}
                  {signal.market_conditions?.expected_move && (
                    <div style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: '500' }}>
                      {signal.market_conditions.expected_move > 0 ? '+' : ''}
                      {signal.market_conditions.expected_move.toFixed(1)}%
                    </div>
                  )}

                  {/* Time */}
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
                    {formatTime(signal.created_at)}
                  </div>

                  {/* Expand icon */}
                  <div style={{ color: '#9ca3af' }}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: '1rem', backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb' }}>
                  {/* News Headline */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem' }}>
                      📰 News Source
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', marginBottom: '0.5rem' }}>
                      {signal.headline}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Significance Score: {signal.significance_score}
                    </div>
                  </div>

                  {/* Wave Analysis Reasoning */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem' }}>
                      🌊 Elliott Wave Analysis
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5' }}>
                      <div style={{ marginBottom: '0.5rem', fontWeight: '500' }}>
                        {signal.wave_description}
                      </div>
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {signal.reasoning}
                      </div>
                    </div>
                  </div>

                  {/* News Reasoning */}
                  {signal.news_reasoning && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem' }}>
                        💡 News Impact Analysis
                      </div>
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        color: '#1e40af'
                      }}>
                        {signal.news_reasoning}
                      </div>
                    </div>
                  )}

                  {/* Market Conditions */}
                  {signal.market_conditions && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem' }}>
                        📊 Market Context
                      </div>
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontFamily: 'Monaco, Consolas, monospace',
                        color: '#6b7280'
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
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
            No {filter !== 'all' ? filter : ''} signals
          </div>
        )}
      </div>
    </Card>
  );
};
