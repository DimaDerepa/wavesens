import React, { useState, useEffect } from 'react';
import { Card } from './Card';

interface Position {
  id: number;
  ticker: string;
  entry_time: string;
  entry_price: number;
  position_size: number;
  shares: number;
  stop_loss_price: number;
  take_profit_price: number;
  max_hold_until: string;
  sp500_entry: number;
}

interface Props {
  apiBaseUrl: string;
}

export const ActivePositions: React.FC<Props> = ({ apiBaseUrl }) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [sp500Price, setSp500Price] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 30000); // Update every 30s (was 10s)
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const loadPositions = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/positions/active`);
      const data = await response.json();
      setPositions(data);
      setLoading(false);

      // Load current prices for all tickers
      if (data.length > 0) {
        const tickers = data.map((p: Position) => p.ticker).join(',');
        loadCurrentPrices(tickers);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
      setLoading(false);
    }
  };

  const loadCurrentPrices = async (tickers: string) => {
    try {
      const allTickers = `${tickers},SPY`; // Include SPY for S&P 500
      const response = await fetch(`${apiBaseUrl}/api/market/current-prices?tickers=${allTickers}`);
      const data = await response.json();

      const { SPY, ...tickerPrices } = data;
      setPrices(tickerPrices);
      if (SPY) setSp500Price(SPY);
    } catch (err) {
      console.error('Failed to load current prices:', err);
    }
  };

  const calculateUnrealizedPnL = (position: Position, currentPrice: number) => {
    const currentValue = position.shares * currentPrice;
    const cost = position.position_size;
    return currentValue - cost;
  };

  const calculatePnLPercent = (position: Position, currentPrice: number) => {
    const pnl = calculateUnrealizedPnL(position, currentPrice);
    return (pnl / position.position_size) * 100;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (maxHoldUntil: string) => {
    const now = new Date();
    const endTime = new Date(maxHoldUntil);
    const diff = endTime.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  return (
    <Card title={`Active Positions (${positions.length})`} loading={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
        {positions.length > 0 ? positions.map((position) => {
          const currentPrice = prices[position.ticker] || position.entry_price;
          const pnl = calculateUnrealizedPnL(position, currentPrice);
          const pnlPercent = calculatePnLPercent(position, currentPrice);
          const isExpanded = expandedPosition === position.id;
          const timeRemaining = getTimeRemaining(position.max_hold_until);

          return (
            <div
              key={position.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                backgroundColor: '#fff'
              }}
            >
              {/* Compact header - always visible */}
              <div
                onClick={() => setExpandedPosition(isExpanded ? null : position.id)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: pnl >= 0 ? '#f0fdf4' : '#fef2f2'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {/* Ticker */}
                  <div style={{ fontWeight: '600', fontSize: '1rem', minWidth: '60px' }}>
                    {position.ticker}
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    ${currentPrice.toFixed(2)}
                  </div>

                  {/* P&L */}
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: pnl >= 0 ? '#059669' : '#dc2626'
                  }}>
                    {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
                  </div>

                  {/* Time remaining */}
                  <div style={{
                    fontSize: '0.75rem',
                    color: timeRemaining.includes('Expired') ? '#dc2626' : '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    ⏱ {timeRemaining}
                  </div>

                  {/* Expand icon */}
                  <div style={{ color: '#9ca3af' }}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Left column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Entry</div>
                        <div style={{ fontSize: '0.875rem' }}>
                          {formatCurrency(position.entry_price)} • {position.shares.toFixed(4)} shares
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {formatTime(position.entry_time)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Position Size</div>
                        <div style={{ fontSize: '0.875rem' }}>{formatCurrency(position.position_size)}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Stop Loss</div>
                        <div style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                          {formatCurrency(position.stop_loss_price)}
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            (-3.0%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Current Price</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                          {formatCurrency(currentPrice)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: pnl >= 0 ? '#059669' : '#dc2626' }}>
                          {formatPercent((currentPrice / position.entry_price - 1) * 100)} from entry
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Take Profit</div>
                        <div style={{ fontSize: '0.875rem', color: '#059669' }}>
                          {formatCurrency(position.take_profit_price)}
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            (+5.0%)
                          </span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Max Hold Until</div>
                        <div style={{ fontSize: '0.875rem' }}>
                          {formatTime(position.max_hold_until)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benchmark comparison */}
                  {position.sp500_entry > 0 && sp500Price > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#ffffff',
                      borderRadius: '0.375rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem' }}>
                        📊 Benchmark (S&P 500)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Entry: </span>
                          {formatCurrency(position.sp500_entry)}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Now: </span>
                          {formatCurrency(sp500Price)}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>S&P: </span>
                          <span style={{
                            color: sp500Price >= position.sp500_entry ? '#059669' : '#dc2626',
                            fontWeight: '500'
                          }}>
                            {formatPercent((sp500Price / position.sp500_entry - 1) * 100)}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Alpha: </span>
                          <span style={{
                            color: pnlPercent > (sp500Price / position.sp500_entry - 1) * 100 ? '#059669' : '#dc2626',
                            fontWeight: '600'
                          }}>
                            {formatPercent(pnlPercent - (sp500Price / position.sp500_entry - 1) * 100)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
            No active positions
          </div>
        )}
      </div>
    </Card>
  );
};
