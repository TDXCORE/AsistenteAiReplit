export interface VoiceSettings {
  selectedVoice: string;
  vadSensitivity: number;
  autoLanguage: boolean;
  smartInterruptions: boolean;
  audioQuality: '16khz' | '24khz' | '48khz';
  noiseSupression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface PerformanceMetrics {
  totalLatency: number;
  audioCaptureLatency: number;
  networkUpLatency: number;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
  networkDownLatency: number;
  audioLevel: number;
  connectionQuality: number;
  uptime: number;
  ping: number;
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  latency?: number;
  confidence?: number;
  language?: string;
  isProcessing?: boolean;
}

export interface SessionStats {
  duration: number;
  messageCount: number;
  totalCost: number;
  avgLatency: number;
}

export interface UsageStats {
  monthlySpend: number;
  budgetLimit: number;
  sttCost: number;
  llmCost: number;
  ttsCost: number;
  totalSessions: number;
  totalMinutes: number;
  avgCostPerConversation: number;
}

export interface WebSocketMessage {
  type: string;
  timestamp: number;
  data?: any;
  [key: string]: any;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type AssistantStatus = 'ready' | 'listening' | 'processing' | 'responding' | 'interrupted';
