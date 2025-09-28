import axios from 'axios';
import { NewsItem, Signal, Experiment, PortfolioSnapshot, SystemStatus, DashboardMetrics } from '../types';

// Try to get backend URL from window object set by backend, fallback to env vars
const getApiBaseUrl = () => {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.BACKEND_URL) {
    // @ts-ignore
    return window.BACKEND_URL;
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

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
  }
};

export default apiService;