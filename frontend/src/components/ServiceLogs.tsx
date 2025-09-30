import React, { useState, useEffect } from 'react';
import { Card } from './Card';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
}

interface ServiceLogsData {
  news_analyzer: LogEntry[];
  signal_extractor: LogEntry[];
  experiment_manager: LogEntry[];
}

interface Props {
  apiBaseUrl: string;
}

export const ServiceLogs: React.FC<Props> = ({ apiBaseUrl }) => {
  const [logs, setLogs] = useState<ServiceLogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<keyof ServiceLogsData>('experiment_manager');

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const loadLogs = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/logs/by-service?limit=50`);
      const data = await response.json();
      setLogs(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setLoading(false);
    }
  };

  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'ERROR':
        return {
          color: '#fca5a5',
          bg: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.3)',
          icon: '🔴'
        };
      case 'WARN':
        return {
          color: '#fcd34d',
          bg: 'rgba(251, 191, 36, 0.15)',
          border: 'rgba(251, 191, 36, 0.3)',
          icon: '🟡'
        };
      case 'INFO':
        return {
          color: '#6ee7b7',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
          icon: '🟢'
        };
      case 'DEBUG':
        return {
          color: '#93c5fd',
          bg: 'rgba(96, 165, 250, 0.15)',
          border: 'rgba(96, 165, 250, 0.3)',
          icon: '🔵'
        };
      default:
        return {
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.15)',
          border: 'rgba(148, 163, 184, 0.3)',
          icon: '⚪'
        };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const serviceConfig = {
    'news_analyzer': {
      label: '📰 News Analyzer',
      color: '#38bdf8'
    },
    'signal_extractor': {
      label: '🌊 Signal Extractor',
      color: '#10b981'
    },
    'experiment_manager': {
      label: '📊 Experiment Manager',
      color: '#f59e0b'
    }
  };

  const currentLogs = logs?.[selectedService] || [];
  const currentConfig = serviceConfig[selectedService];

  // Group logs by level for summary
  const logSummary = currentLogs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Service Logs</span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Log summary */}
            {currentLogs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', marginRight: '1rem' }}>
                {Object.entries(logSummary).map(([level, count]) => {
                  const config = getLevelConfig(level);
                  return (
                    <div key={level} style={{
                      padding: '0.25rem 0.5rem',
                      background: config.bg,
                      border: `1px solid ${config.border}`,
                      borderRadius: '0.375rem',
                      color: config.color,
                      fontWeight: '600'
                    }}>
                      {config.icon} {count}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Service selector */}
            {Object.entries(serviceConfig).map(([service, config]) => (
              <button
                key={service}
                onClick={() => setSelectedService(service as keyof ServiceLogsData)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  backgroundColor: selectedService === service ? config.color : 'rgba(71, 85, 105, 0.3)',
                  color: selectedService === service ? '#0f172a' : '#94a3b8',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {config.label}
                {logs && (
                  <span style={{
                    marginLeft: '0.375rem',
                    opacity: selectedService === service ? 1 : 0.7
                  }}>
                    ({logs[service as keyof ServiceLogsData]?.length || 0})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      }
      loading={loading}
    >
      <div>
        {/* Service header */}
        <div style={{
          padding: '1rem',
          background: `linear-gradient(135deg, ${currentConfig.color}20 0%, ${currentConfig.color}05 100%)`,
          border: `2px solid ${currentConfig.color}50`,
          borderRadius: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                {currentConfig.label}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {currentLogs.length} log entries • Updated every 30s
              </div>
            </div>
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(71, 85, 105, 0.3)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                STATUS
              </div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#10b981' }}>
                ● Running
              </div>
            </div>
          </div>
        </div>

        {/* Logs list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentLogs && currentLogs.length > 0 ? (
            currentLogs.map((log, index) => {
              const levelConfig = getLevelConfig(log.level);

              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  style={{
                    background: levelConfig.bg,
                    border: `1px solid ${levelConfig.border}`,
                    borderLeft: `4px solid ${levelConfig.color}`,
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Log header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        padding: '0.375rem 0.75rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '0.375rem',
                        border: `1px solid ${levelConfig.border}`,
                        color: levelConfig.color,
                        fontSize: '0.8125rem',
                        fontWeight: '700',
                        fontFamily: 'Monaco, Consolas, monospace'
                      }}>
                        {levelConfig.icon} {log.level}
                      </div>
                      <div style={{
                        fontSize: '0.8125rem',
                        color: '#94a3b8',
                        fontFamily: 'Monaco, Consolas, monospace'
                      }}>
                        {formatTime(log.timestamp)}
                      </div>
                    </div>
                  </div>

                  {/* Log message */}
                  <div style={{
                    fontSize: '0.9375rem',
                    color: '#e2e8f0',
                    lineHeight: '1.6',
                    fontFamily: 'Monaco, Consolas, monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {log.message}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '4rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '0.75rem',
              border: '2px dashed rgba(71, 85, 105, 0.3)'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem'
              }}>
                📝
              </div>
              <div style={{
                color: '#64748b',
                fontSize: '1.125rem',
                fontWeight: '500',
                marginBottom: '0.5rem'
              }}>
                No logs available
              </div>
              <div style={{
                color: '#475569',
                fontSize: '0.875rem'
              }}>
                {currentConfig.label} hasn't generated any logs yet
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
