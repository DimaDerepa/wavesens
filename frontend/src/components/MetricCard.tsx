import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  className = ''
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      default:
        return '→';
    }
  };

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 p-6 hover:border-gray-600 transition-all ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="text-2xl">{icon}</span>}
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{value}</div>
          {subtitle && <div className="text-sm text-gray-400">{subtitle}</div>}
        </div>
        {trend && trendValue && (
          <div className={`text-right ${getTrendColor()}`}>
            <div className="text-xl font-bold">
              {getTrendIcon()} {trendValue}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;