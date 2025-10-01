import { WebSocketMessage } from '../types';

export type WebSocketEventType = 'news' | 'signal' | 'experiment' | 'portfolio' | 'system_status';

export interface WebSocketSubscription {
  unsubscribe: () => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<WebSocketEventType, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private url: string;

  constructor() {
    // Railway service reference solution
    const getWsUrl = () => {
      // For Railway: use window.location.hostname to detect if we're on Railway
      if (typeof window !== 'undefined' && window.location.hostname.includes('.railway.app')) {
        // We're on Railway, use the backend WebSocket URL
        return 'wss://backend-production-7a68.up.railway.app/ws';
      }

      // Check environment variables for local development
      if (process.env.REACT_APP_WS_URL) {
        return process.env.REACT_APP_WS_URL;
      }

      if (process.env.REACT_APP_BACKEND_URL) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        return backendUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
      }

      // Local development fallback
      return 'ws://localhost:8000/ws';
    };

    this.url = getWsUrl();
    this.initializeEventTypes();
  }

  private initializeEventTypes() {
    const eventTypes: WebSocketEventType[] = ['news', 'signal', 'experiment', 'portfolio', 'system_status'];
    eventTypes.forEach(type => {
      this.listeners.set(type, new Set());
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection before creating a new one
        if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
          console.log('Closing existing WebSocket connection before reconnecting');
          this.ws.close(1000, 'Reconnecting');
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(message.data);
        } catch (error) {
          console.error('Error in WebSocket listener callback:', error);
        }
      });
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  subscribe(eventType: WebSocketEventType, callback: (data: any) => void): WebSocketSubscription {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(callback);
    }

    return {
      unsubscribe: () => {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
          listeners.delete(callback);
        }
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;