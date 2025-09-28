import axios from 'axios';
import { NewsItem, Signal, Experiment, PortfolioSnapshot, SystemStatus, DashboardMetrics } from '../types';

// Railway service reference solution
const getApiBaseUrl = () => {
  // For Railway: use window.location.origin to detect if we're on Railway
  if (typeof window !== 'undefined' && window.location.hostname.includes('.railway.app')) {
    // We're on Railway, use the hardcoded backend URL
    return 'https://backend-production-7a68.up.railway.app';
  }

  // Check environment variables for local development
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }

  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Local development fallback
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

export const apiService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await api.get('/api/dashboard/metrics');
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
    const response = await api.get('/api/system/logs');
    return response.data;
  },

  async getTokenUsage(): Promise<any> {
    const response = await api.get('/api/system/tokens');
    return response.data;
  },

  async changeModel(modelId: string): Promise<any> {
    const response = await api.post('/api/system/model', { model_id: modelId });
    return response.data;
  }
};

export default apiService;