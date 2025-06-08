import { WebSocketMessage, ConnectionStatus } from '../types/voice';

export class VoiceWebSocketManager {
  private controlWs: WebSocket | null = null;
  private audioWs: WebSocket | null = null;
  private clientId: string;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private onMessage?: (message: WebSocketMessage) => void;
  private onConnectionStatusChange?: (status: ConnectionStatus) => void;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async connect() {
    if (this.connectionStatus === 'connecting') {
      return; // Prevent multiple simultaneous connection attempts
    }
    
    this.setConnectionStatus('connecting');
    
    try {
      // Close any existing connections first
      this.disconnect();
      
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connect sequentially to avoid race conditions
      await this.connectControlWebSocket();
      await this.connectAudioWebSocket();
      
      this.setConnectionStatus('connected');
      this.reconnectAttempts = 0;
      console.log('WebSocket connections established successfully');
    } catch (error) {
      console.error('Failed to connect WebSockets:', error);
      this.setConnectionStatus('error');
      this.scheduleReconnect();
    }
  }

  private async connectControlWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${this.clientId}&type=control`;
    
    this.controlWs = new WebSocket(wsUrl);
    
    return new Promise<void>((resolve, reject) => {
      if (!this.controlWs) return reject(new Error('Failed to create WebSocket'));

      this.controlWs.onopen = () => {
        console.log('Control WebSocket connected successfully');
        // Send initial connection confirmation
        this.controlWs?.send(JSON.stringify({
          type: 'connection_ready',
          timestamp: Date.now(),
          clientId: this.clientId
        }));
        resolve();
      };

      this.controlWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse control message:', error);
        }
      };

      this.controlWs.onclose = (event) => {
        console.log('Control WebSocket disconnected');
        this.controlWs = null;
        if (this.connectionStatus === 'connected' && !event.wasClean) {
          this.setConnectionStatus('disconnected');
          this.scheduleReconnect();
        }
      };

      this.controlWs.onerror = (error) => {
        console.error('Control WebSocket error:', error);
        reject(error);
      };
    });
  }

  private async connectAudioWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${this.clientId}&type=audio`;
    
    this.audioWs = new WebSocket(wsUrl);
    this.audioWs.binaryType = 'arraybuffer';
    
    return new Promise<void>((resolve, reject) => {
      if (!this.audioWs) return reject(new Error('Failed to create WebSocket'));

      this.audioWs.onopen = () => {
        console.log('Audio WebSocket connected successfully');
        // Send initial connection confirmation
        const confirmationBuffer = new TextEncoder().encode(JSON.stringify({
          type: 'audio_connection_ready',
          timestamp: Date.now(),
          clientId: this.clientId
        }));
        this.audioWs?.send(confirmationBuffer);
        resolve();
      };

      this.audioWs.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Handle incoming audio data (TTS response)
          this.playAudioResponse(event.data);
        }
      };

      this.audioWs.onclose = (event) => {
        console.log('Audio WebSocket disconnected');
        this.audioWs = null;
        if (this.connectionStatus === 'connected' && !event.wasClean) {
          this.setConnectionStatus('disconnected');
          this.scheduleReconnect();
        }
      };

      this.audioWs.onerror = (error) => {
        console.error('Audio WebSocket error:', error);
        reject(error);
      };
    });
  }

  sendControlMessage(message: WebSocketMessage) {
    if (this.controlWs && this.controlWs.readyState === WebSocket.OPEN) {
      this.controlWs.send(JSON.stringify(message));
    } else {
      console.warn('Control WebSocket not connected');
    }
  }

  sendAudioData(audioData: Float32Array) {
    if (this.audioWs && this.audioWs.readyState === WebSocket.OPEN) {
      // Convert Float32Array to PCM16 for Deepgram
      const pcm16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        // Clamp values to [-1, 1] and convert to 16-bit signed integer
        const clamped = Math.max(-1, Math.min(1, audioData[i]));
        pcm16[i] = clamped * 32767;
      }
      this.audioWs.send(pcm16.buffer);
    }
  }

  private playAudioResponse(audioData: ArrayBuffer) {
    // Create audio buffer and play TTS response
    const audioContext = new AudioContext();
    
    audioContext.decodeAudioData(audioData)
      .then(audioBuffer => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      })
      .catch(error => {
        console.error('Failed to play audio response:', error);
      });
  }

  private setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.onConnectionStatusChange?.(status);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setConnectionStatus('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 + (this.reconnectAttempts * 500), 5000);
    
    setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}`);
      // Reset connection status before attempting to reconnect
      this.controlWs = null;
      this.audioWs = null;
      this.connect();
    }, delay);
  }

  setMessageHandler(handler: (message: WebSocketMessage) => void) {
    this.onMessage = handler;
  }

  setConnectionStatusHandler(handler: (status: ConnectionStatus) => void) {
    this.onConnectionStatusChange = handler;
  }

  disconnect() {
    this.setConnectionStatus('disconnected');
    
    if (this.controlWs && this.controlWs.readyState === WebSocket.OPEN) {
      this.controlWs.close(1000, 'Client disconnect');
      this.controlWs = null;
    }
    
    if (this.audioWs && this.audioWs.readyState === WebSocket.OPEN) {
      this.audioWs.close(1000, 'Client disconnect');
      this.audioWs = null;
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
}
