// Fallback connection for when WebSockets don't work in public domains
export class FallbackConnection {
  private clientId: string;
  private pollInterval?: NodeJS.Timeout;
  private isPolling = false;
  private onMessage?: (message: any) => void;
  private lastMessageId = 0;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async connect() {
    // Start polling for messages
    this.isPolling = true;
    this.startPolling();
  }

  private startPolling() {
    if (!this.isPolling) return;
    
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages/${this.clientId}?after=${this.lastMessageId}`);
        if (response.ok) {
          const messages = await response.json();
          messages.forEach((message: any) => {
            this.lastMessageId = Math.max(this.lastMessageId, message.id);
            this.onMessage?.(message);
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000); // Poll every second
  }

  async sendMessage(message: any) {
    try {
      await fetch(`/api/messages/${this.clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  async sendAudioData(audioData: ArrayBuffer) {
    try {
      await fetch(`/api/audio/${this.clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audioData
      });
    } catch (error) {
      console.error('Send audio error:', error);
    }
  }

  setMessageHandler(handler: (message: any) => void) {
    this.onMessage = handler;
  }

  disconnect() {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}