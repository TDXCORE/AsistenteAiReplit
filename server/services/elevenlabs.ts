import { ElevenLabs } from 'elevenlabs';

export class ElevenLabsService {
  private client: ElevenLabs;

  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
    this.client = new ElevenLabsApi({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
    this.streamingClient = new ElevenLabsStreamingApi({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  async generateSpeech(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB'): Promise<ArrayBuffer> {
    try {
      const audio = await this.client.textToSpeech.generate({
        voice_id: voiceId,
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      });

      // Convert stream to ArrayBuffer
      const chunks: Uint8Array[] = [];
      const reader = audio.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result.buffer;
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw new Error('Failed to generate speech with ElevenLabs');
    }
  }

  async generateStreamingSpeech(
    text: string, 
    onAudioChunk: (chunk: ArrayBuffer) => void,
    voiceId: string = 'pNInz6obpgDQGcFmaJgB'
  ): Promise<void> {
    try {
      const stream = await this.streamingClient.textToSpeechStream({
        voice_id: voiceId,
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      });

      const reader = stream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onAudioChunk(value.buffer);
      }
    } catch (error) {
      console.error('ElevenLabs streaming TTS error:', error);
      throw new Error('Failed to generate streaming speech with ElevenLabs');
    }
  }

  async getVoices() {
    try {
      const response = await this.client.voices.getAll();
      return response.voices;
    } catch (error) {
      console.error('ElevenLabs get voices error:', error);
      throw new Error('Failed to get voices from ElevenLabs');
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const voices = await this.getVoices();
      return voices && voices.length > 0;
    } catch (error) {
      console.error('ElevenLabs test failed:', error);
      return false;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();