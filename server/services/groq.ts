import Groq from 'groq-sdk';

export class GroqService {
  private client: Groq;

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async generateResponse(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an ultra-realistic voice assistant. Respond naturally and conversationally, as if you were a helpful human assistant. Keep responses concise but informative. Use natural speech patterns and contractions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: options.model || "llama-3.1-8b-instant",
        max_tokens: options.maxTokens || 75,
        temperature: options.temperature || 0.5,
        stream: false,
      });

      return completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Groq API error:', error);
      throw new Error('Failed to generate response from Groq');
    }
  }

  async generateStreamResponse(prompt: string, onChunk: (chunk: string) => void, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an ultra-realistic voice assistant. Respond naturally and conversationally, as if you were a helpful human assistant. Keep responses concise but informative. Use natural speech patterns and contractions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: options.model || "llama-3.1-8b-instant",
        max_tokens: options.maxTokens || 75,
        temperature: options.temperature || 0.5,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('Groq streaming error:', error);
      throw new Error('Failed to generate streaming response from Groq');
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse("Hello", { maxTokens: 10 });
      return response.length > 0;
    } catch (error) {
      console.error('Groq test failed:', error);
      return false;
    }
  }
}

export const groqService = new GroqService();