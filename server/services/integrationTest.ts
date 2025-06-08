import { deepgramService } from './deepgram';
import { groqService } from './groq';
import { elevenLabsService } from './elevenlabs';

export interface IntegrationTestResult {
  service: string;
  status: 'success' | 'error';
  latency?: number;
  error?: string;
  details?: any;
}

export class IntegrationTestService {
  async runFullIntegrationTest(): Promise<{
    success: boolean;
    results: IntegrationTestResult[];
    totalLatency: number;
  }> {
    const results: IntegrationTestResult[] = [];
    const startTime = Date.now();

    // Test Deepgram STT
    const deepgramResult = await this.testDeepgram();
    results.push(deepgramResult);

    // Test Groq LLM
    const groqResult = await this.testGroq();
    results.push(groqResult);

    // Test ElevenLabs TTS
    const elevenLabsResult = await this.testElevenLabs();
    results.push(elevenLabsResult);

    const totalLatency = Date.now() - startTime;
    const success = results.every(result => result.status === 'success');

    return {
      success,
      results,
      totalLatency
    };
  }

  private async testDeepgram(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    try {
      const isConnected = await deepgramService.testConnection();
      const latency = Date.now() - startTime;

      if (isConnected) {
        return {
          service: 'Deepgram STT',
          status: 'success',
          latency,
          details: { message: 'Connection successful' }
        };
      } else {
        return {
          service: 'Deepgram STT',
          status: 'error',
          latency,
          error: 'Connection failed'
        };
      }
    } catch (error) {
      return {
        service: 'Deepgram STT',
        status: 'error',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testGroq(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    try {
      const response = await groqService.generateResponse("Say 'test successful'", { maxTokens: 10 });
      const latency = Date.now() - startTime;

      return {
        service: 'Groq LLM',
        status: 'success',
        latency,
        details: { response: response.substring(0, 50) + '...' }
      };
    } catch (error) {
      return {
        service: 'Groq LLM',
        status: 'error',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testElevenLabs(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    try {
      const voices = await elevenLabsService.getVoices();
      const latency = Date.now() - startTime;

      return {
        service: 'ElevenLabs TTS',
        status: 'success',
        latency,
        details: { voicesCount: voices.length }
      };
    } catch (error) {
      return {
        service: 'ElevenLabs TTS',
        status: 'error',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testEndToEndPipeline(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    try {
      // Test the complete pipeline: mock audio → STT → LLM → TTS
      console.log('Starting end-to-end pipeline test...');

      // 1. Test LLM generation (simulating STT result)
      const testPrompt = "Hello, can you hear me? Please respond with a short greeting.";
      const llmResponse = await groqService.generateResponse(testPrompt, { maxTokens: 50 });
      
      // 2. Test TTS generation
      const audioBuffer = await elevenLabsService.generateSpeech(llmResponse);
      
      const latency = Date.now() - startTime;

      return {
        service: 'End-to-End Pipeline',
        status: 'success',
        latency,
        details: {
          llmResponse: llmResponse.substring(0, 100),
          audioSize: audioBuffer.byteLength
        }
      };
    } catch (error) {
      return {
        service: 'End-to-End Pipeline',
        status: 'error',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const integrationTestService = new IntegrationTestService();