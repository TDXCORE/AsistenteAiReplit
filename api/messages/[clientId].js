const { Groq } = require('groq-sdk');
const { ElevenLabs } = require('elevenlabs');

// Initialize services directly in serverless function
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const elevenlabs = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// Global storage for serverless functions
const messageQueues = new Map();
const audioQueues = new Map();
const clients = new Map();
let messageIdCounter = 1;

module.exports = async function handler(req, res) {
  const { clientId } = req.query;
  
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    const message = req.body;
    
    try {
      let client = clients.get(clientId);
      if (!client) {
        client = {
          id: clientId,
          isRecording: false,
          languageHistory: [],
          audioBuffer: [],
          isProcessing: false,
          isPlaying: false
        };
        clients.set(clientId, client);
      }
      
      await handleControlMessage(client, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
  
  if (req.method === 'GET') {
    const after = parseInt(req.query.after) || 0;
    const queue = messageQueues.get(clientId) || [];
    const newMessages = queue.filter(msg => msg.id > after);
    res.json(newMessages);
  }
};

async function handleControlMessage(client, message) {
  console.log(`Handling message type: ${message.type} for client ${client.id}`);
  
  switch (message.type) {
    case 'start_recording':
      client.isRecording = true;
      sendControlMessage(client, {
        type: 'recording_started',
        timestamp: Date.now(),
      });
      break;
      
    case 'stop_recording':
      client.isRecording = false;
      sendControlMessage(client, {
        type: 'recording_stopped',
        timestamp: Date.now(),
      });
      break;
      
    case 'voice_input':
      console.log(`Voice input received: "${message.text}", isProcessing: ${client.isProcessing}`);
      if (message.text && !client.isProcessing) {
        console.log('Starting voice pipeline processing...');
        await processCompleteVoicePipeline(client, message.text);
      } else {
        console.log('Skipping voice processing - already processing or no text');
      }
      break;
      
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

function sendControlMessage(client, message) {
  const messageWithId = { ...message, id: messageIdCounter++ };
  if (!messageQueues.has(client.id)) {
    messageQueues.set(client.id, []);
  }
  messageQueues.get(client.id).push(messageWithId);
  
  const queue = messageQueues.get(client.id);
  if (queue.length > 50) {
    queue.splice(0, queue.length - 50);
  }
}

async function processCompleteVoicePipeline(client, transcript) {
  if (client.isProcessing) return;
  
  client.isProcessing = true;
  const startTime = Date.now();
  
  try {
    console.log(`Processing voice input: "${transcript}" for client ${client.id}`);
    
    // Generate AI response using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres un asistente de voz útil y amigable. Responde en español de manera natural y conversacional."
        },
        {
          role: "user",
          content: transcript
        }
      ],
      model: "mixtral-8x7b-32768",
      max_tokens: 150,
      temperature: 0.7
    });
    
    const response = completion.choices[0]?.message?.content || "Lo siento, no pude procesar tu solicitud.";
    console.log(`Generated AI response: "${response}"`);
    
    // Generate TTS audio using ElevenLabs
    const audioResponse = await elevenlabs.generate({
      voice: "pNInz6obpgDQGcFmaJgB",
      text: response,
      model_id: "eleven_multilingual_v2"
    });
    
    // Convert audio stream to buffer
    const audioChunks = [];
    for await (const chunk of audioResponse) {
      audioChunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(audioChunks);
    console.log(`Generated TTS audio: ${audioBuffer.length} bytes`);
    
    const totalLatency = Date.now() - startTime;
    
    // Send text response
    sendControlMessage(client, {
      type: 'response_ready',
      timestamp: Date.now(),
      response: {
        text: response,
        latency: totalLatency,
      },
    });
    
    // Queue audio for HTTP delivery
    if (!audioQueues.has(client.id)) {
      audioQueues.set(client.id, []);
    }
    audioQueues.get(client.id).push(audioBuffer);
    
    sendControlMessage(client, {
      type: 'audio_ready',
      timestamp: Date.now(),
      audioLength: audioBuffer.byteLength,
    });
    
    console.log(`Completed voice pipeline for client ${client.id} in ${totalLatency}ms`);
    
  } catch (error) {
    console.error(`Voice pipeline error for client ${client.id}:`, error);
    sendControlMessage(client, {
      type: 'error',
      timestamp: Date.now(),
      error: `Failed to process voice request: ${error.message}`,
    });
  } finally {
    client.isProcessing = false;
  }
}