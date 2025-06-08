import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceWebSocketManager } from '../lib/websocket';
import { audioProcessor } from '../lib/audio';
import { 
  VoiceSettings, 
  PerformanceMetrics, 
  ConversationMessage, 
  SessionStats, 
  UsageStats,
  ConnectionStatus,
  AssistantStatus,
  WebSocketMessage 
} from '../types/voice';

export function useVoiceAssistant() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('ready');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalLatency: 0,
    audioCaptureLatency: 0,
    networkUpLatency: 0,
    sttLatency: 0,
    llmLatency: 0,
    ttsLatency: 0,
    networkDownLatency: 0,
    audioLevel: 0,
    connectionQuality: 5,
    uptime: 99.8,
    ping: 0,
  });

  const [sessionStats, setSessionStats] = useState<SessionStats>({
    duration: 0,
    messageCount: 0,
    totalCost: 0,
    avgLatency: 0,
  });

  const [usageStats, setUsageStats] = useState<UsageStats>({
    monthlySpend: 0,
    budgetLimit: 50,
    sttCost: 0,
    llmCost: 0,
    ttsCost: 0,
    totalSessions: 0,
    totalMinutes: 0,
    avgCostPerConversation: 0,
  });

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    selectedVoice: 'cloned',
    vadSensitivity: 65,
    autoLanguage: true,
    smartInterruptions: true,
    audioQuality: '16khz',
    noiseSupression: true,
    echoCancellation: true,
    autoGainControl: false,
  });

  const [integrationTestResults, setIntegrationTestResults] = useState<any>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);

  const wsManagerRef = useRef<VoiceWebSocketManager | null>(null);
  const clientIdRef = useRef<string>(generateClientId());
  const sessionStartRef = useRef<number | null>(null);

  // Initialize WebSocket connection and audio processor
  useEffect(() => {
    let wsManager: VoiceWebSocketManager | null = null;
    let isInitialized = false;

    const initializeConnection = async () => {
      try {
        wsManager = new VoiceWebSocketManager(clientIdRef.current);
        wsManagerRef.current = wsManager;

        wsManager.setConnectionStatusHandler(setConnectionStatus);
        wsManager.setMessageHandler(handleWebSocketMessage);

        // Initialize audio processor
        await audioProcessor.initialize();
        console.log('Audio processor initialized successfully');

        // Connect WebSocket with delay to ensure page is fully loaded
        setTimeout(() => {
          if (wsManager && !isInitialized) {
            wsManager.connect();
            isInitialized = true;
          }
        }, 1000);

      } catch (error) {
        console.error('Failed to initialize voice assistant:', error);
      }
    };

    initializeConnection();

    return () => {
      isInitialized = false;
      if (wsManager) {
        wsManager.disconnect();
      }
      audioProcessor.cleanup();
    };
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'server_ready':
        console.log('Server connection confirmed');
        break;

      case 'recording_started':
        setAssistantStatus('listening');
        break;

      case 'transcript_update':
        if (message.isFinal) {
          const userMessage: ConversationMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: message.transcript,
            timestamp: message.timestamp,
            confidence: message.confidence,
            language: message.language,
          };
          setMessages(prev => [...prev, userMessage]);
          setCurrentTranscript('');
          setAssistantStatus('processing');
        } else {
          setCurrentTranscript(message.transcript);
        }
        break;

      case 'response_ready':
        const assistantMessage: ConversationMessage = {
          id: Date.now().toString(),
          type: 'assistant',
          content: message.response.text,
          timestamp: message.timestamp,
          latency: message.response.latency,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setAssistantStatus('responding');
        setIsPlaying(true);
        
        // Update metrics
        setMetrics(prev => ({
          ...prev,
          totalLatency: message.response.latency,
        }));
        break;

      case 'audio_level':
        setAudioLevel(message.level);
        setMetrics(prev => ({
          ...prev,
          audioLevel: message.level,
        }));
        break;

      case 'interrupted':
        setAssistantStatus('ready');
        setIsPlaying(false);
        break;

      case 'pong':
        setMetrics(prev => ({
          ...prev,
          ping: message.latency,
        }));
        break;

      case 'integration_test_results':
        setIntegrationTestResults(message.results);
        setIsTestRunning(false);
        break;

      case 'integration_test_error':
        console.error('Integration test error:', message.error);
        setIsTestRunning(false);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || !wsManagerRef.current) return;

    try {
      setIsRecording(true);
      setAssistantStatus('listening');
      sessionStartRef.current = Date.now();

      // Send start recording message
      wsManagerRef.current.sendControlMessage({
        type: 'start_recording',
        timestamp: Date.now(),
      });

      // Start audio processing
      await audioProcessor.startRecording(
        (audioData) => {
          wsManagerRef.current?.sendAudioData(audioData);
        },
        (level) => {
          setAudioLevel(level);
        }
      );
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setAssistantStatus('ready');
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !wsManagerRef.current) return;

    setIsRecording(false);
    setAssistantStatus('processing');

    // Stop audio processing
    audioProcessor.stopRecording();

    // Send stop recording message
    wsManagerRef.current.sendControlMessage({
      type: 'stop_recording',
      timestamp: Date.now(),
    });
  }, [isRecording]);

  const interrupt = useCallback(() => {
    if (!wsManagerRef.current) return;

    setIsPlaying(false);
    setAssistantStatus('ready');

    wsManagerRef.current.sendControlMessage({
      type: 'interrupt',
      timestamp: Date.now(),
    });
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setCurrentTranscript('');
    setIsRecording(false);
    setIsPlaying(false);
    setAssistantStatus('ready');
    setAudioLevel(0);
    sessionStartRef.current = null;
    
    setSessionStats({
      duration: 0,
      messageCount: 0,
      totalCost: 0,
      avgLatency: 0,
    });
  }, []);

  const updateVoiceSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...newSettings }));
    
    if (wsManagerRef.current) {
      wsManagerRef.current.sendControlMessage({
        type: 'settings_update',
        timestamp: Date.now(),
        data: newSettings,
      });
    }
  }, []);

  const runIntegrationTest = useCallback(() => {
    if (!wsManagerRef.current) return;

    setIsTestRunning(true);
    setIntegrationTestResults(null);
    
    wsManagerRef.current.sendControlMessage({
      type: 'run_integration_test',
      timestamp: Date.now(),
    });
  }, []);

  // Update session stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionStartRef.current) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        setSessionStats(prev => ({
          ...prev,
          duration,
          messageCount: messages.length,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [messages.length]);

  // Simulate real-time metric updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        audioCaptureLatency: 25 + Math.random() * 10,
        networkUpLatency: 40 + Math.random() * 20,
        sttLatency: 80 + Math.random() * 30,
        llmLatency: 120 + Math.random() * 40,
        ttsLatency: 350 + Math.random() * 100,
        networkDownLatency: 30 + Math.random() * 15,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return {
    // State
    connectionStatus,
    assistantStatus,
    isRecording,
    isPlaying,
    messages,
    currentTranscript,
    audioLevel,
    metrics,
    sessionStats,
    usageStats,
    voiceSettings,

    // Actions
    startRecording,
    stopRecording,
    interrupt,
    resetConversation,
    updateVoiceSettings,
    runIntegrationTest,
    
    // Integration Test
    integrationTestResults,
    isTestRunning,
  };
}

function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
