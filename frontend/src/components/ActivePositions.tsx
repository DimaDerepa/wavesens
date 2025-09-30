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
    const interval = setInterval(loadPositions, 30000); // Update every 30s
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {positions.length > 0 ? positions.map((position) => {
          const currentPrice = prices[position.ticker] || position.entry_price;
          const pnl = calculateUnrealizedPnL(position, currentPrice);
          const pnlPercent = calculatePnLPercent(position, currentPrice);
          const isExpanded = expandedPosition === position.id;
          const timeRemaining = getTimeRemaining(position.max_hold_until);
          const sp500Return = position.sp500_entry > 0 && sp500Price > 0
            ? (sp500Price / position.sp500_entry - 1) * 100
            : 0;
          const alpha = pnlPercent - sp500Return;

          return (
            <div
              key={position.id}
              style={{
                background: pnl >= 0
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)',
                borderRadius: '1rem',
                border: pnl >= 0 ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid rgba(239, 68, 68, 0.3)',
                overflow: 'hidden',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Main Card - Always visible */}
              <div
                onClick={() => setExpandedPosition(isExpanded ? null : position.id)}
                style={{
                  padding: '1.5rem',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr auto',
                  gap: '2rem',
                  alignItems: 'center'
                }}
              >
                {/* Left: Ticker & Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{
                    fontWeight: '800',
                    fontSize: '2rem',
                    color: '#fff',
                    letterSpacing: '-0.025em'
                  }}>
                    {position.ticker}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: timeRemaining.includes('Expired') ? '#f87171' : '#94a3b8',
                    fontWeight: '600'
                  }}>
                    ⏱ {timeRemaining}
                  </div>
                </div>

                {/* Middle: Key Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1.5rem'
                }}>
                  {/* Current Price */}
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.375rem'
                    }}>
                      Current
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      ${currentPrice.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: pnl >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: '600'
                    }}>
                      {formatPercent((currentPrice / position.entry_price - 1) * 100)}
                    </div>
                  </div>

                  {/* Entry Price */}
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.375rem'
                    }}>
                      Entry
                    </div>
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#cbd5e1'
                    }}>
                      ${position.entry_price.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#64748b'
                    }}>
                      {position.shares.toFixed(4)} sh
                    </div>
                  </div>

                  {/* Position Size */}
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.375rem'
                    }}>
                      Size
                    </div>
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#cbd5e1'
                    }}>
                      {formatCurrency(position.position_size)}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#64748b'
                    }}>
                      Cost Basis
                    </div>
                  </div>

                  {/* Unrealized P&L */}
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.375rem'
                    }}>
                      Unrealized
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '800',
                      color: pnl >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {formatCurrency(pnl)}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: pnl >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: '700'
                    }}>
                      {formatPercent(pnlPercent)}
                    </div>
                  </div>
                </div>

                {/* Right: Expand Icon */}
                <div style={{
                  fontSize: '1.5rem',
                  color: '#64748b',
                  transition: 'transform 0.3s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>
                  ▶
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{
                  padding: '1.5rem',
                  paddingTop: '0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem'
                }}>
                  {/* Risk Management */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    border: '1px solid rgba(71, 85, 105, 0.3)'
                  }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#94a3b8',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: '1rem'
                    }}>
                      🛡️ Risk Management
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                          STOP LOSS
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>
                          {formatCurrency(position.stop_loss_price)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.25rem' }}>
                          -3.0% Risk
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                          TAKE PROFIT
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                          {formatCurrency(position.take_profit_price)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.25rem' }}>
                          +5.0% Target
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                          MAX HOLD
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#cbd5e1' }}>
                          {formatTime(position.max_hold_until)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Entered: {formatTime(position.entry_time)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benchmark Comparison */}
                  {position.sp500_entry > 0 && sp500Price > 0 && (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      border: '1px solid rgba(56, 189, 248, 0.3)'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#38bdf8',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: '1rem'
                      }}>
                        📊 Benchmark vs S&P 500
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                            S&P 500 ENTRY
                          </div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#cbd5e1' }}>
                            {formatCurrency(position.sp500_entry)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                            S&P 500 NOW
                          </div>
                          <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#cbd5e1' }}>
                            {formatCurrency(sp500Price)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                            S&P 500 RETURN
                          </div>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: sp500Return >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {formatPercent(sp500Return)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                            ALPHA
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            color: alpha >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {formatPercent(alpha)}
                          </div>
                        </div>
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
            color: '#64748b',
            fontSize: '1.125rem',
            fontWeight: '500'
          }}>
            No active positions
          </div>
        )}
      </div>
    </Card>
  );
};
