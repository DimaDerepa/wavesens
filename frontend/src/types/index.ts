export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  url: string;
  published_at: string;
  is_significant: boolean;
  significance_score: number;
  reasoning: string;
  created_at: string;
}

export interface Signal {
  id: string;
  news_id: string;
  ticker: string;
  action: 'BUY' | 'SELL' | 'SHORT';
  wave: number;
  entry_start: string;
  entry_optimal: string;
  entry_end: string;
  expected_move_percent: number;
  confidence: number;
  reasoning: string;
  created_at: string;
  headline?: string;
}

export interface Experiment {
  id: string;
  signal_id: string;
  news_id: string;
  ticker: string;
  action: 'BUY' | 'SELL' | 'SHORT';
  confidence: number;
  entry_time: string;
  exit_time?: string;
  position_size: number;
  shares: number;
  entry_price: number;
  exit_price?: number;
  stop_loss_price: number;
  take_profit_price: number;
  commission: number;
  gross_pnl?: number;
  net_pnl?: number;
  return_percent?: number;
  sp500_return?: number;
  alpha?: number;
  exit_reason?: string;
  status: 'active' | 'closed';
}

export interface PortfolioSnapshot {
  timestamp: string;
  total_value: number;
  cash_balance: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl_today: number;
  positions_count: number;
  sp500_value: number;
  benchmark_return: number;
  total_return: number;
  alpha: number;
}

export interface SystemStatus {
  news_analyzer: {
    status: 'running' | 'stopped' | 'error';
    last_check: string;
    news_processed_today: number;
    significant_news_today: number;
  };
  signal_extractor: {
    status: 'running' | 'stopped' | 'error';
    last_signal: string;
    signals_generated_today: number;
  };
  experiment_manager: {
    status: 'running' | 'stopped' | 'error';
    active_positions: number;
    portfolio_value: number;
    daily_pnl: number;
  };
}

export interface WaveAnalysis {
  wave: number;
  name: string;
  duration: string;
  participants: string;
  typical_move: string;
  color: string;
}

export interface DashboardMetrics {
  portfolio: {
    total_value: number;
    cash_balance: number;
    positions_count: number;
    daily_pnl: number;
    total_return: number;
    alpha_vs_sp500: number;
  };
  performance: {
    win_rate: number;
    avg_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    total_trades: number;
  };
  recent_activity: {
    latest_news: NewsItem[];
    latest_signals: Signal[];
    latest_experiments: Experiment[];
  };
  system_status: {
    uptime_hours: number;
    uptime_display: string;
    news_analyzer: {
      status: 'running' | 'stopped' | 'error';
      last_check: string;
      news_processed_today: number;
    };
    signal_extractor: {
      status: 'running' | 'stopped' | 'error';
      last_signal: string;
      signals_generated_today: number;
    };
    experiment_manager: {
      status: 'running' | 'stopped' | 'error';
      active_positions: number;
      portfolio_value: number;
    };
  };
}

export interface WebSocketMessage {
  type: 'news' | 'signal' | 'experiment' | 'portfolio' | 'system_status';
  data: any;
  timestamp: string;
}