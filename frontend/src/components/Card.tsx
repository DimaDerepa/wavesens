import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  error?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  loading = false,
  error
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">⚠️ Error</div>
            <div className="text-gray-600 text-sm">{error}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Card;