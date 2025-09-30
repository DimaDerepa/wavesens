import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface WaveData {
  wave: number;
  count: number;
  percentage: number;
}

interface Props {
  apiBaseUrl: string;
}

export const ElliottWaveChart: React.FC<Props> = ({ apiBaseUrl }) => {
  const [waveData, setWaveData] = useState<WaveData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWaveData();
    const interval = setInterval(loadWaveData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const loadWaveData = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/analysis/waves`);
      const data = await response.json();

      // Convert object to array for chart
      const chartData = [0, 1, 2, 3, 4, 5, 6].map(wave => ({
        wave,
        count: data[wave]?.count || 0,
        percentage: data[wave]?.percentage || 0
      }));

      setWaveData(chartData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load wave data:', err);
      setLoading(false);
    }
  };

  const getWaveColor = (wave: number) => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280', '#ec4899'];
    return colors[wave] || '#9ca3af';
  };

  const getWaveDescription = (wave: number) => {
    const descriptions = [
      'Wave 0: Initial momentum (0-5min)',
      'Wave 1: Early trend (5-30min)',
      'Wave 2: Correction (30-120min)',
      'Wave 3: Strong trend (2-6hrs)',
      'Wave 4: Consolidation (6-24hrs)',
      'Wave 5: Final push (1-3 days)',
      'Wave 6: Long term (3-7 days)'
    ];
    return descriptions[wave] || '';
  };

  const totalSignals = waveData.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card title="Elliott Wave Distribution (7 days)" loading={loading}>
      <div>
        {/* Chart */}
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={waveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="wave"
              tickFormatter={(value) => `W${value}`}
              style={{ fontSize: '0.75rem', fill: '#6b7280' }}
            />
            <YAxis
              style={{ fontSize: '0.75rem', fill: '#6b7280' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        Wave {data.wave}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {data.count} signals ({data.percentage.toFixed(1)}%)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {getWaveDescription(data.wave)}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {waveData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getWaveColor(entry.wave)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend with counts */}
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {waveData.filter(d => d.count > 0).map((data) => (
            <div
              key={data.wave}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: getWaveColor(data.wave)
                }} />
                <div style={{ fontSize: '0.875rem', color: '#374151', minWidth: '60px' }}>
                  Wave {data.wave}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', flex: 1 }}>
                  {getWaveDescription(data.wave)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  {data.count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', minWidth: '50px', textAlign: 'right' }}>
                  {data.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#eff6ff',
          borderRadius: '0.375rem',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#1e40af', textAlign: 'center' }}>
            <span style={{ fontWeight: '600' }}>{totalSignals}</span> total signals in last 7 days
          </div>
        </div>
      </div>
    </Card>
  );
};
