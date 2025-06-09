// Import required modules for serverless environment
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// File-based storage for serverless compatibility
const tempDir = '/tmp';
let messageIdCounter = 1;

function getAudioFilePath(clientId) {
  return path.join(tempDir, `audio_${clientId}.json`);
}

function addAudioToQueue(clientId, audioBuffer) {
  try {
    const filePath = getAudioFilePath(clientId);
    let queue = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      queue = JSON.parse(data);
    }
    queue.push(Array.from(audioBuffer)); // Convert ArrayBuffer to array for JSON storage
    fs.writeFileSync(filePath, JSON.stringify(queue));
  } catch (error) {
    console.error('Error writing audio queue:', error);
  }
}

// Simple in-memory storage for this serverless function
let messageQueues = new Map();
let clients = new Map();

module.exports = async function handler(req, res) {
  const { clientId } = req.query;
  
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Debug environment variables
  console.log('Environment check:', {
    hasGroqKey: !!process.env.GROQ_API_KEY,
    hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
    groqKeyPrefix: process.env.GROQ_API_KEY?.substring(0, 8) + '...',
    elevenLabsKeyPrefix: process.env.ELEVENLABS_API_KEY?.substring(0, 8) + '...'
  });
  
  if (req.method === 'POST') {
    const message = req.body;
    console.log(`Received POST message for client ${clientId}:`, message);
    
    try {
      let client = clients.get(clientId);
      if (!client) {
        console.log(`Creating new client: ${clientId}`);
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
      console.error(`Error processing message for client ${clientId}:`, error);
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
      
    case 'init':
      console.log(`Client ${client.id} initialized`);
      sendControlMessage(client, {
        type: 'init_response',
        timestamp: Date.now(),
        status: 'ready'
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
      model: "llama3-8b-8192",
      max_tokens: 150,
      temperature: 0.7
    });
    
    const response = completion.choices[0]?.message?.content || "Lo siento, no pude procesar tu solicitud.";
    console.log(`Generated AI response: "${response}"`);
    
    // Generate TTS audio using ElevenLabs direct API
    const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: response,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });
    
    if (!ttsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${ttsResponse.status}`);
    }
    
    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(`Generated TTS audio: ${audioBuffer.byteLength} bytes`);
    
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
    
    // Queue audio for HTTP delivery using file storage
    addAudioToQueue(client.id, audioBuffer);
    
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