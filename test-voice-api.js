// Simple test script to verify voice API functionality
import { Groq } from 'groq-sdk';
import { ElevenLabs } from 'elevenlabs';

async function testVoiceAPI() {
  console.log('Testing voice API services...');
  
  try {
    // Test Groq API
    console.log('Testing Groq API...');
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Responde en español brevemente."
        },
        {
          role: "user",
          content: "Hola"
        }
      ],
      model: "llama3-8b-8192",
      max_tokens: 50,
      temperature: 0.7
    });
    
    const response = completion.choices[0]?.message?.content;
    console.log('Groq response:', response);
    
    // Test ElevenLabs API
    console.log('Testing ElevenLabs API...');
    const elevenlabs = new ElevenLabs({
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    
    const audioResponse = await elevenlabs.generate({
      voice: "pNInz6obpgDQGcFmaJgB",
      text: "Hola mundo",
      model_id: "eleven_multilingual_v2"
    });
    
    const audioChunks = [];
    for await (const chunk of audioResponse) {
      audioChunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(audioChunks);
    console.log('ElevenLabs audio generated:', audioBuffer.length, 'bytes');
    
    console.log('All tests passed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testVoiceAPI();