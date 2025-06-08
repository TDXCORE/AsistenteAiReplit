export class ElevenLabsService {
  private apiKey: string;

  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
    this.apiKey = process.env.ELEVENLABS_API_KEY;
  }

  async generateSpeech(text: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB'): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: false,
          },
          output_format: 'mp3_22050_32',
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      return await response.arrayBuffer();
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
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: false,
          },
          output_format: 'mp3_22050_32',
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs streaming API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get stream reader');
      }

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
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs voices API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices;
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