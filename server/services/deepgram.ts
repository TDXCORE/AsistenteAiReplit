import { createClient, LiveTranscriptionEvents, LiveSchema } from '@deepgram/sdk';

export class DeepgramService {
  private client;
  private activeConnections = new Map<string, any>();

  constructor() {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    this.client = createClient(process.env.DEEPGRAM_API_KEY);
  }

  async createLiveTranscription(clientId: string, onTranscript: (data: any) => void, onError: (error: any) => void) {
    const connection = this.client.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 500,
      vad_events: true,
      endpointing: 200,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    } as LiveSchema);

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`Deepgram connection opened for client: ${clientId}`);
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      console.log(`Deepgram transcript event for client ${clientId}:`, JSON.stringify(data, null, 2));
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim()) {
        console.log(`Processing transcript for client ${clientId}: "${transcript}" (final: ${data.is_final})`);
        onTranscript({
          transcript,
          is_final: data.is_final,
          confidence: data.channel?.alternatives?.[0]?.confidence || 0,
          words: data.channel?.alternatives?.[0]?.words || [],
        });
      } else {
        console.log(`Empty or invalid transcript for client ${clientId}:`, data);
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error(`Deepgram error for client ${clientId}:`, error);
      onError(error);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`Deepgram connection closed for client: ${clientId}`);
      this.activeConnections.delete(clientId);
    });

    this.activeConnections.set(clientId, connection);
    return connection;
  }

  sendAudioData(clientId: string, audioData: ArrayBuffer) {
    const connection = this.activeConnections.get(clientId);
    if (connection) {
      connection.send(audioData);
    }
  }

  closeConnection(clientId: string) {
    const connection = this.activeConnections.get(clientId);
    if (connection) {
      connection.finish();
      this.activeConnections.delete(clientId);
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.manage.getProjects();
      return true; // If no error thrown, connection is working
    } catch (error) {
      console.error('Deepgram test failed:', error);
      return false;
    }
  }
}

export const deepgramService = new DeepgramService();