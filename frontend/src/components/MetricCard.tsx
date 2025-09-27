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
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="text-gray-500">{icon}</span>}
            <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
        {trend && trendValue && (
          <div className={`text-right ${getTrendColor()}`}>
            <div className="text-sm font-medium">
              {getTrendIcon()} {trendValue}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;