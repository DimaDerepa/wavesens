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
      const response = await fetch(`${apiBaseUrl}/api/logs/by-service?limit=100`);
      const data = await response.json();
      setLogs(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return '#f87171';
      case 'WARN': return '#fbbf24';
      case 'INFO': return '#34d399';
      case 'DEBUG': return '#60a5fa';
      default: return '#9ca3af';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const serviceLabels = {
    'news_analyzer': '📰 News Analyzer',
    'signal_extractor': '🌊 Signal Extractor',
    'experiment_manager': '📊 Experiment Manager'
  };

  const currentLogs = logs?.[selectedService] || [];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Service Logs</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {Object.keys(serviceLabels).map((service) => (
              <button
                key={service}
                onClick={() => setSelectedService(service as keyof ServiceLogsData)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  backgroundColor: selectedService === service ? '#3b82f6' : '#e5e7eb',
                  color: selectedService === service ? '#fff' : '#6b7280',
                  whiteSpace: 'nowrap'
                }}
              >
                {serviceLabels[service as keyof typeof serviceLabels]}
                {logs && (
                  <span style={{
                    marginLeft: '0.25rem',
                    fontWeight: '600',
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
      <div style={{
        maxHeight: '500px',
        overflowY: 'auto',
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        padding: '1rem',
        fontSize: '0.75rem',
        fontFamily: 'Monaco, Consolas, "Courier New", monospace'
      }}>
        {currentLogs && currentLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {currentLogs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                style={{
                  borderLeft: `3px solid ${getLevelColor(log.level)}`,
                  paddingLeft: '0.75rem',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem'
                }}
              >
                {/* Header with level and timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    color: getLevelColor(log.level),
                    fontWeight: '700',
                    minWidth: '50px'
                  }}>
                    [{log.level}]
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                    {formatTime(log.timestamp)}
                  </span>
                </div>

                {/* Message */}
                <div style={{
                  color: '#e5e7eb',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            color: '#9ca3af',
            textAlign: 'center',
            padding: '3rem',
            fontStyle: 'italic'
          }}>
            No recent logs available for {serviceLabels[selectedService]}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {currentLogs && currentLogs.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#9ca3af'
        }}>
          Showing {currentLogs.length} most recent entries • Updates every 30s
        </div>
      )}
    </Card>
  );
};
