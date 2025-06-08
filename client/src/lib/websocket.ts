import { WebSocketMessage, ConnectionStatus } from '../types/voice';

export class VoiceWebSocketManager {
  private controlWs: WebSocket | null = null;
  private audioWs: WebSocket | null = null;
  private clientId: string;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onMessage?: (message: WebSocketMessage) => void;
  private onConnectionStatusChange?: (status: ConnectionStatus) => void;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async connect() {
    this.setConnectionStatus('connecting');
    
    try {
      await Promise.all([
        this.connectControlWebSocket(),
        this.connectAudioWebSocket()
      ]);
      
      this.setConnectionStatus('connected');
      this.reconnectAttempts = 0;
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
        console.log('Control WebSocket connected');
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

      this.controlWs.onclose = () => {
        console.log('Control WebSocket disconnected');
        this.controlWs = null;
        if (this.connectionStatus === 'connected') {
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
        console.log('Audio WebSocket connected');
        resolve();
      };

      this.audioWs.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Handle incoming audio data (TTS response)
          this.playAudioResponse(event.data);
        }
      };

      this.audioWs.onclose = () => {
        console.log('Audio WebSocket disconnected');
        this.audioWs = null;
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
      // Convert Float32Array to ArrayBuffer for transmission
      const buffer = new ArrayBuffer(audioData.length * 4);
      const view = new Float32Array(buffer);
      view.set(audioData);
      this.audioWs.send(buffer);
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
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}`);
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
    
    if (this.controlWs) {
      this.controlWs.close();
      this.controlWs = null;
    }
    
    if (this.audioWs) {
      this.audioWs.close();
      this.audioWs = null;
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
}
