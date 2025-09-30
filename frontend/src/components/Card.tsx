import React from 'react';

interface CardProps {
  title?: React.ReactNode;
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
    <div className={`bg-gray-800 rounded-xl shadow-2xl border border-gray-700 ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">⚠️ Error</div>
            <div className="text-gray-400 text-sm">{error}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Card;