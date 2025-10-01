import axios from 'axios';
import { NewsItem, Signal, Experiment, PortfolioSnapshot, SystemStatus, DashboardMetrics } from '../types';

// API Base URL configuration
const getApiBaseUrl = () => {
  // Check environment variables first
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // For Railway: detect if we're on Railway and use Railway backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('.railway.app')) {
    return 'https://backend-production-7a68.up.railway.app';
  }

  // Local development - API server runs on port 8000
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// Debug logging to console to see what URL is being used
console.log('🔗 API Configuration:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  REACT_APP_BACKEND_URL:', process.env.REACT_APP_BACKEND_URL);
console.log('  REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('  Final API_BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Export API_BASE_URL for components that need direct access
export { API_BASE_URL };

export const apiService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await api.get('/api/dashboard/metrics');
    return response.data;
  },

  async getActivePositions(): Promise<any[]> {
    const response = await api.get('/api/positions/active');
    return response.data;
  },

  async getSignalsWithReasoning(limit = 50): Promise<any[]> {
    const response = await api.get(`/api/signals/with-reasoning?limit=${limit}`);
    return response.data;
  },

  async getServiceLogs(limit = 100): Promise<any> {
    const response = await api.get(`/api/logs/by-service?limit=${limit}`);
    return response.data;
  },

  async getSystemStatus(): Promise<SystemStatus> {
    const response = await api.get('/api/system/status');
    return response.data;
  },

  async getNews(limit = 50): Promise<NewsItem[]> {
    const response = await api.get(`/api/news?limit=${limit}`);
    return response.data;
  },

  async getSignificantNews(limit = 20): Promise<NewsItem[]> {
    const response = await api.get(`/api/news/significant?limit=${limit}`);
    return response.data;
  },

  async getSignals(limit = 50): Promise<Signal[]> {
    const response = await api.get(`/api/signals?limit=${limit}`);
    return response.data;
  },

  async getActiveSignals(): Promise<Signal[]> {
    const response = await api.get('/api/signals/active');
    return response.data;
  },

  async getExperiments(limit = 50): Promise<Experiment[]> {
    const response = await api.get(`/api/experiments?limit=${limit}`);
    return response.data;
  },

  async getActiveExperiments(): Promise<Experiment[]> {
    const response = await api.get('/api/experiments/active');
    return response.data;
  },

  async getClosedExperiments(limit = 50): Promise<Experiment[]> {
    const response = await api.get(`/api/experiments/closed?limit=${limit}`);
    return response.data;
  },

  async getPortfolioSnapshots(hours = 24): Promise<PortfolioSnapshot[]> {
    const response = await api.get(`/api/portfolio/snapshots?hours=${hours}`);
    return response.data;
  },

  async getCurrentPortfolio(): Promise<PortfolioSnapshot> {
    const response = await api.get('/api/portfolio/current');
    return response.data;
  },

  async getPerformanceMetrics(days = 30): Promise<any> {
    const response = await api.get(`/api/performance/metrics?days=${days}`);
    return response.data;
  },

  async getWaveAnalysis(): Promise<any> {
    const response = await api.get('/api/analysis/waves');
    return response.data;
  },

  async getPnlHistory(days = 30): Promise<any> {
    const response = await api.get(`/api/portfolio/pnl-history?days=${days}`);
    return response.data;
  },

  async getSystemLogs(): Promise<any> {
    // Return empty logs without making a request
    // Use ServiceLogs component instead which calls /api/logs/by-service
    return {
      "news_analyzer": [],
      "signal_extractor": [],
      "experiment_manager": []
    };
  },

  async getTokenUsage(): Promise<any> {
    // Return empty token usage without making a request
    // This endpoint doesn't exist yet
    return {
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0
    };
  },

  async changeModel(modelId: string): Promise<any> {
    const response = await api.post('/api/system/model', { model_id: modelId });
    return response.data;
  }
};

export default apiService;