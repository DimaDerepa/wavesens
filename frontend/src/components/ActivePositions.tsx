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
  const [currentPage, setCurrentPage] = useState(1);
  const [marketClosed, setMarketClosed] = useState(false);
  const itemsPerPage = 5;

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

      // Check if market is closed (no prices or all prices are 0)
      const priceValues = Object.values(tickerPrices) as number[];
      const hasPrices = Object.keys(tickerPrices).length > 0 &&
                        priceValues.some(p => p > 0);
      setMarketClosed(!hasPrices);

      setPrices(tickerPrices);
      if (SPY) setSp500Price(SPY);
    } catch (err) {
      console.error('Failed to load current prices:', err);
      setMarketClosed(true);
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

  const getPnLColor = (value: number) => {
    if (Math.abs(value) < 0.01) return '#94a3b8'; // Neutral gray for ~0%
    return value >= 0 ? '#10b981' : '#ef4444';
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

  const getTimeRemaining = (maxHoldUntil: string) => {
    const now = new Date();
    const endTime = new Date(maxHoldUntil);
    const diff = endTime.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const totalPages = Math.ceil(positions.length / itemsPerPage);
  const paginatedPositions = positions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Active Positions ({positions.length})</span>
          {marketClosed && (
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              color: '#fca5a5',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              🕒 Market Closed - Showing Last Prices
            </div>
          )}
        </div>
      }
      loading={loading}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {paginatedPositions.length > 0 ? paginatedPositions.map((position) => {
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
                      color: getPnLColor((currentPrice / position.entry_price - 1) * 100),
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
                      Invested
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '800',
                      color: '#38bdf8'
                    }}>
                      {formatCurrency(position.position_size)}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#64748b'
                    }}>
                      Position Size
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
                      color: getPnLColor(pnlPercent)
                    }}>
                      {formatCurrency(pnl)}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: getPnLColor(pnlPercent),
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
                            color: getPnLColor(sp500Return)
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
                            color: getPnLColor(alpha)
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
              Page {currentPage} of {totalPages} • Showing {paginatedPositions.length} of {positions.length}
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
