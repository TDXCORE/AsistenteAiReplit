const { Groq } = require('groq-sdk');

// Test endpoint for Vercel deployment
module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test environment variables
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    
    console.log('Environment check:', {
      hasGroqKey,
      hasElevenLabsKey,
      groqKeyPrefix: process.env.GROQ_API_KEY?.substring(0, 8) + '...',
      elevenLabsKeyPrefix: process.env.ELEVENLABS_API_KEY?.substring(0, 8) + '...'
    });

    if (!hasGroqKey || !hasElevenLabsKey) {
      return res.status(500).json({
        error: 'API keys not configured',
        hasGroqKey,
        hasElevenLabsKey
      });
    }

    // Test Groq API
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: "Di 'Hola' en español"
        }
      ],
      model: "llama3-8b-8192",
      max_tokens: 10,
      temperature: 0.7
    });

    const groqResponse = completion.choices[0]?.message?.content || "Error";

    // Test ElevenLabs API
    const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: "Hola",
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    const ttsSuccess = ttsResponse.ok;
    const audioSize = ttsSuccess ? (await ttsResponse.arrayBuffer()).byteLength : 0;

    return res.status(200).json({
      status: 'success',
      groq: {
        working: true,
        response: groqResponse
      },
      elevenlabs: {
        working: ttsSuccess,
        audioSize: audioSize,
        error: ttsSuccess ? null : `${ttsResponse.status}: ${ttsResponse.statusText}`
      },
      environment: {
        hasGroqKey,
        hasElevenLabsKey
      }
    });

  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};