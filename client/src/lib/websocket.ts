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
  private isPublicDomain = false;
  private pollInterval?: NodeJS.Timeout;
  private lastMessageId = 0;

  constructor(clientId: string) {
    this.clientId = clientId;
    // Detect if we're on a public Replit domain
    this.isPublicDomain = window.location.host.includes('.replit.dev') || 
                         window.location.host.includes('.replit.app');
  }

  async connect() {
    if (this.connectionStatus === 'connecting') {
      return;
    }
    
    this.setConnectionStatus('connecting');
    
    if (this.isPublicDomain) {
      // Use HTTP polling for public domains
      console.log('Using HTTP polling for public domain');
      this.startHttpPolling();
      this.setConnectionStatus('connected');
      return;
    }
    
    try {
      this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 200));
      
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

    return new Promise<void>((resolve, reject) => {
      this.controlWs = new WebSocket(wsUrl);

      this.controlWs.onopen = () => {
        console.log('Control WebSocket connected successfully');
        resolve();
      };

      this.controlWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'server_connected') {
            console.log('Server connection confirmed');
            return;
          }
          this.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse control message:', error);
        }
      };

      this.controlWs.onclose = (event) => {
        console.log(`Control WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
        this.controlWs = null;
        if (event.code !== 1000) {
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

    return new Promise<void>((resolve, reject) => {
      this.audioWs = new WebSocket(wsUrl);

      this.audioWs.onopen = () => {
        console.log('Audio WebSocket connected successfully');
        resolve();
      };

      this.audioWs.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.playAudioResponse(event.data);
        }
      };

      this.audioWs.onclose = (event) => {
        console.log(`Audio WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
        this.audioWs = null;
        if (event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.audioWs.onerror = (error) => {
        console.error('Audio WebSocket error:', error);
        reject(error);
      };
    });
  }

  private startHttpPolling() {
    // Initialize client on server
    fetch(`/api/messages/${this.clientId}`, { 
      method: 'POST', 
      body: JSON.stringify({ type: 'init' }), 
      headers: { 'Content-Type': 'application/json' } 
    });
    
    // Start polling for messages
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages/${this.clientId}?after=${this.lastMessageId}`);
        if (response.ok) {
          const messages = await response.json();
          messages.forEach((message: any) => {
            if (message.id > this.lastMessageId) {
              this.lastMessageId = message.id;
              this.onMessage?.(message);
            }
          });
        }
      } catch (error) {
        console.error('HTTP polling error:', error);
      }
    }, 500);
  }

  sendControlMessage(message: WebSocketMessage) {
    if (this.isPublicDomain) {
      fetch(`/api/messages/${this.clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      }).catch(error => console.error('Failed to send control message:', error));
    } else if (this.controlWs && this.controlWs.readyState === WebSocket.OPEN) {
      this.controlWs.send(JSON.stringify(message));
    }
  }

  sendAudioData(audioData: Float32Array) {
    if (this.isPublicDomain) {
      const buffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      fetch(`/api/audio/${this.clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      }).catch(error => console.error('Failed to send audio data:', error));
    } else if (this.audioWs && this.audioWs.readyState === WebSocket.OPEN) {
      // Convert Float32Array to PCM16 for Deepgram
      const pcm16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const clamped = Math.max(-1, Math.min(1, audioData[i]));
        pcm16[i] = clamped * 32767;
      }
      this.audioWs.send(pcm16.buffer);
    }
  }

  private playAudioResponse(audioData: ArrayBuffer) {
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
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    if (this.controlWs) {
      if (this.controlWs.readyState === WebSocket.OPEN || this.controlWs.readyState === WebSocket.CONNECTING) {
        this.controlWs.close(1000, 'Client disconnect');
      }
      this.controlWs = null;
    }
    
    if (this.audioWs) {
      if (this.audioWs.readyState === WebSocket.OPEN || this.audioWs.readyState === WebSocket.CONNECTING) {
        this.audioWs.close(1000, 'Client disconnect');
      }
      this.audioWs = null;
    }
    
    this.setConnectionStatus('disconnected');
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
}