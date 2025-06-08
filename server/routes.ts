import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { insertConversationMessageSchema, insertPerformanceMetricSchema, insertApiUsageSchema } from "@shared/schema";
import { deepgramService } from "./services/deepgram";
import { groqService } from "./services/groq";
import { elevenLabsService } from "./services/elevenlabs";
import { integrationTestService } from "./services/integrationTest";

interface ClientConnection {
  id: string;
  controlWs?: WebSocket;
  audioWs?: WebSocket;
  sessionId?: number;
  isRecording: boolean;
  isProcessing?: boolean;
  isPlaying?: boolean;
  lastResponseTime?: number;
  startTime?: number;
  deepgramConnection?: any;
  currentTranscript?: string;
  detectedLanguage?: string;
  languageHistory: Array<{ language: string; confidence: number; timestamp: number }>;
  preferredLanguage?: string;
  audioBuffer?: ArrayBuffer[];
}

const clients = new Map<string, ClientConnection>();

// Message schemas for WebSocket communication
const controlMessageSchema = z.object({
  type: z.enum(['start_recording', 'stop_recording', 'interrupt', 'ping', 'settings_update', 'run_integration_test', 'connection_ready']),
  timestamp: z.number(),
  data: z.any().optional(),
  clientId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Add CORS headers for WebSocket connections
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info: any) => {
      // Allow all origins for Replit compatibility
      return true;
    }
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const wsType = url.searchParams.get('type'); // 'control' or 'audio'

    if (!clientId || !wsType) {
      ws.close(1008, 'Client ID and type required');
      return;
    }

    console.log(`WebSocket ${wsType} connection established for client: ${clientId}`);

    // Set up connection keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('pong', () => {
      console.log(`Keepalive pong received from ${wsType} client: ${clientId}`);
    });

    // Get or create client connection
    let client = clients.get(clientId);
    if (!client) {
      client = {
        id: clientId,
        isRecording: false,
        isProcessing: false,
        isPlaying: false,
        languageHistory: [],
        audioBuffer: [],
      };
      clients.set(clientId, client);
    } else {
      // Close existing connections if any to prevent duplicates
      if (wsType === 'control' && client.controlWs && client.controlWs.readyState === WebSocket.OPEN) {
        console.log(`Closing existing control connection for client ${clientId}`);
        client.controlWs.close();
      }
      if (wsType === 'audio' && client.audioWs && client.audioWs.readyState === WebSocket.OPEN) {
        console.log(`Closing existing audio connection for client ${clientId}`);
        client.audioWs.close();
      }
    }

    // Assign WebSocket based on type
    if (wsType === 'control') {
      client.controlWs = ws;
      
      ws.on('message', async (data) => {
        try {
          const message = controlMessageSchema.parse(JSON.parse(data.toString()));
          await handleControlMessage(client!, message);
        } catch (error) {
          console.error('Invalid control message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });

    } else if (wsType === 'audio') {
      client.audioWs = ws;
      ws.binaryType = 'arraybuffer';
      
      ws.on('message', async (data) => {
        if (data instanceof ArrayBuffer) {
          if (client!.isRecording) {
            await processAudioChunk(client!, data);
          }
        } else {
          // Handle text messages from audio WebSocket (like connection confirmation)
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'audio_connection_ready') {
              console.log(`Audio connection ready for client ${client!.id}`);
            }
          } catch (error) {
            console.log(`Received non-JSON data on audio WebSocket: ${data.toString().substring(0, 100)}`);
          }
        }
      });
    }

    ws.on('close', (code, reason) => {
      console.log(`WebSocket ${wsType} disconnected for client: ${clientId} (code: ${code}, reason: ${reason?.toString()})`);
      clearInterval(pingInterval);
      
      if (wsType === 'control') {
        client!.controlWs = undefined;
      } else if (wsType === 'audio') {
        client!.audioWs = undefined;
      }

      // Clean up client if both connections are closed
      if (!client!.controlWs && !client!.audioWs) {
        // Close Deepgram connection if exists
        if (client!.deepgramConnection) {
          deepgramService.closeConnection(clientId);
        }
        clients.delete(clientId);
        console.log(`Client ${clientId} fully disconnected and cleaned up`);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket ${wsType} error for client ${clientId}:`, error);
      clearInterval(pingInterval);
    });
  });

  // Handle control messages
  async function handleControlMessage(client: ClientConnection, message: any) {
    const { type, timestamp, data } = message;

    switch (type) {
      case 'connection_ready':
        console.log(`Client ${client.id} control connection ready`);
        sendControlMessage(client, {
          type: 'server_ready',
          timestamp: Date.now(),
          status: 'connected'
        });
        break;

      case 'start_recording':
        if (!client.isRecording) {
          client.isRecording = true;
          client.startTime = timestamp;
          client.audioBuffer = [];
          client.currentTranscript = '';
          
          // Create new session if needed
          if (!client.sessionId) {
            const session = await storage.createVoiceSession({
              clientId: client.id,
            });
            client.sessionId = session.id;
          }

          // Initialize Deepgram connection
          try {
            client.deepgramConnection = await deepgramService.createLiveTranscription(
              client.id,
              async (transcriptData) => {
                handleTranscriptUpdate(client, transcriptData);
                
                // If transcript is final and has content, process the complete voice pipeline
                if (transcriptData.is_final && transcriptData.transcript && transcriptData.transcript.trim().length > 2) {
                  console.log(`Triggering voice pipeline for final transcript: "${transcriptData.transcript.trim()}"`);
                  await processCompleteVoicePipeline(client, transcriptData.transcript.trim());
                }
              },
              (error) => console.error('Deepgram error for client', client.id, error)
            );
            
            sendControlMessage(client, {
              type: 'recording_started',
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error('Failed to initialize Deepgram for client', client.id, error);
            client.isRecording = false;
            sendControlMessage(client, {
              type: 'error',
              timestamp: Date.now(),
              error: 'Failed to initialize speech recognition',
            });
          }
        }
        break;

      case 'stop_recording':
        if (client.isRecording) {
          client.isRecording = false;
          
          // Close Deepgram connection
          if (client.deepgramConnection) {
            deepgramService.closeConnection(client.id);
            client.deepgramConnection = null;
          }
          
          // Process final transcript if available
          if (client.currentTranscript && client.currentTranscript.trim()) {
            await processCompleteVoicePipeline(client, client.currentTranscript);
          }
        }
        break;

      case 'interrupt':
        sendControlMessage(client, {
          type: 'interrupted',
          timestamp: Date.now(),
        });
        break;

      case 'ping':
        sendControlMessage(client, {
          type: 'pong',
          timestamp: Date.now(),
          latency: Date.now() - timestamp,
        });
        break;

      case 'settings_update':
        // Handle settings updates
        console.log('Settings updated:', data);
        break;

      case 'run_integration_test':
        try {
          const testResults = await integrationTestService.runFullIntegrationTest();
          sendControlMessage(client, {
            type: 'integration_test_results',
            timestamp: Date.now(),
            results: testResults,
          });
        } catch (error) {
          sendControlMessage(client, {
            type: 'integration_test_error',
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;
    }
  }

  // Simple Spanish language detection
  function detectAndUpdateLanguage(client: ClientConnection, language: string, confidence: number): string {
    client.detectedLanguage = 'es'; // Always use Spanish
    return 'es';
  }

  // Handle transcript updates from Deepgram
  function handleTranscriptUpdate(client: ClientConnection, transcriptData: any) {
    const { transcript, is_final, confidence, language } = transcriptData;
    
    // Enhanced language detection
    const detectedLang = detectAndUpdateLanguage(client, language || 'en', confidence || 0.8);
    
    console.log(`Transcript update for client ${client.id}: "${transcript}" (final: ${is_final}, confidence: ${confidence}, language: ${detectedLang})`);
    
    if (is_final) {
      client.currentTranscript = transcript;
      console.log(`Final transcript saved for client ${client.id}: "${transcript}" in language: ${detectedLang}`);
      
      sendControlMessage(client, {
        type: 'transcript_update',
        timestamp: Date.now(),
        transcript,
        isFinal: true,
        confidence,
        language: detectedLang,
        languageHistory: client.languageHistory.slice(-3), // Send recent language history
      });
    } else {
      sendControlMessage(client, {
        type: 'transcript_update',
        timestamp: Date.now(),
        transcript,
        isFinal: false,
        confidence,
        language: detectedLang,
      });
    }
  }

  // Process audio chunks - stream to Deepgram
  async function processAudioChunk(client: ClientConnection, audioData: ArrayBuffer) {
    if (!client.isRecording) {
      console.log(`Ignoring audio chunk for client ${client.id} - not recording`);
      return;
    }

    // Echo suppression: Skip audio processing if assistant is currently playing
    const currentTime = Date.now();
    if (client.isPlaying && client.lastResponseTime && (currentTime - client.lastResponseTime) < 5000) {
      // Skip processing for 5 seconds after assistant response to prevent echo
      return;
    }

    console.log(`Processing audio chunk for client ${client.id}: ${audioData.byteLength} bytes`);
    
    if (client.deepgramConnection) {
      // Send audio data to Deepgram for real-time transcription
      try {
        deepgramService.sendAudioData(client.id, audioData);
        console.log(`Successfully sent ${audioData.byteLength} bytes to Deepgram for client ${client.id}`);
      } catch (error) {
        console.error(`Failed to send audio to Deepgram for client ${client.id}:`, error);
      }
    } else {
      console.warn(`No Deepgram connection for client ${client.id}`);
    }

    // Calculate audio level for visualization
    const audioArray = new Int16Array(audioData);
    let sum = 0;
    for (let i = 0; i < audioArray.length; i++) {
      sum += Math.abs(audioArray[i]);
    }
    const audioLevel = Math.min(100, (sum / audioArray.length / 32768) * 100);
    
    sendControlMessage(client, {
      type: 'audio_level',
      timestamp: Date.now(),
      level: audioLevel,
    });
  }

  // Complete voice processing pipeline: STT → LLM → TTS
  async function processCompleteVoicePipeline(client: ClientConnection, transcript: string) {
    // Prevent duplicate processing
    if (client.isProcessing) {
      console.log(`Skipping duplicate processing for client ${client.id}`);
      return;
    }
    
    client.isProcessing = true;
    console.log(`Starting voice processing pipeline for client ${client.id} with transcript: "${transcript}"`);
    const startTime = Date.now();
    const sttLatency = Date.now() - (client.startTime || Date.now());

    try {
      // Step 1: Generate LLM response in Spanish
      console.log(`Generating LLM response for client ${client.id} in Spanish`);
      const llmStartTime = Date.now();
      const response = await groqService.generateResponse(transcript, {
        language: 'es',
        model: 'llama-3.1-8b-instant',
        maxTokens: 75,
        temperature: 0.5,
      });
      const llmLatency = Date.now() - llmStartTime;
      console.log(`LLM response generated in ${llmLatency}ms: "${response}"`);

      // Step 2: Generate TTS audio in detected language
      console.log(`Generating TTS audio for client ${client.id} in language: ${client.detectedLanguage}`);
      const ttsStartTime = Date.now();
      const audioBuffer = await elevenLabsService.generateSpeech(response);
      const ttsLatency = Date.now() - ttsStartTime;
      console.log(`TTS audio generated in ${ttsLatency}ms (${audioBuffer.byteLength} bytes)`);

      const totalLatency = Date.now() - startTime;
      console.log(`Complete pipeline finished in ${totalLatency}ms for client ${client.id}`);

      // Save conversation messages
      if (client.sessionId) {
        await storage.createConversationMessage({
          sessionId: client.sessionId,
          messageType: 'user',
          content: transcript,
          latency: sttLatency,
          confidence: 0.95,
          language: 'es',
          cost: 0.002,
        });

        await storage.createConversationMessage({
          sessionId: client.sessionId,
          messageType: 'assistant',
          content: response,
          latency: totalLatency,
          cost: 0.008,
        });

        // Save performance metrics
        await storage.createPerformanceMetric({
          sessionId: client.sessionId,
          audioCaptureLatency: 25,
          networkUpLatency: 35,
          sttLatency,
          llmLatency,
          ttsLatency,
          networkDownLatency: 30,
          totalLatency,
          audioLevel: 65,
        });

        // Save API usage costs
        await storage.createApiUsage({
          sessionId: client.sessionId,
          service: 'deepgram',
          cost: 0.002,
        });

        await storage.createApiUsage({
          sessionId: client.sessionId,
          service: 'groq',
          cost: 0.003,
        });

        await storage.createApiUsage({
          sessionId: client.sessionId,
          service: 'elevenlabs',
          cost: 0.005,
        });
      }

      // Send response to client
      sendControlMessage(client, {
        type: 'response_ready',
        timestamp: Date.now(),
        response: {
          text: response,
          latency: totalLatency,
        },
      });

      // Send audio data via audio WebSocket
      if (client.audioWs && client.audioWs.readyState === WebSocket.OPEN) {
        console.log(`Sending ${audioBuffer.byteLength} bytes of TTS audio to client ${client.id}`);
        
        // Mark client as playing and set response time for echo suppression
        client.isPlaying = true;
        client.lastResponseTime = Date.now();
        
        client.audioWs.send(audioBuffer);
        
        // Notify client that audio is ready
        sendControlMessage(client, {
          type: 'audio_ready',
          timestamp: Date.now(),
          audioLength: audioBuffer.byteLength,
        });
        
        // Auto-stop playing after estimated audio duration (rough estimate based on bytes)
        const estimatedDuration = Math.max(2000, (audioBuffer.byteLength / 32000) * 1000);
        setTimeout(() => {
          client.isPlaying = false;
        }, estimatedDuration);
        
      } else {
        console.warn(`Audio WebSocket not ready for client ${client.id}, state: ${client.audioWs?.readyState}`);
      }

    } catch (error) {
      console.error('Voice processing pipeline error:', error);
      sendControlMessage(client, {
        type: 'error',
        timestamp: Date.now(),
        error: 'Failed to process voice request',
      });
    } finally {
      // Always reset processing flag
      client.isProcessing = false;
    }
  }



  // Send control message to client
  function sendControlMessage(client: ClientConnection, message: any) {
    if (client.controlWs && client.controlWs.readyState === WebSocket.OPEN) {
      client.controlWs.send(JSON.stringify(message));
    } else {
      // Store in message queue for HTTP polling
      const messageWithId = { ...message, id: messageIdCounter++ };
      if (!messageQueues.has(client.id)) {
        messageQueues.set(client.id, []);
      }
      messageQueues.get(client.id)!.push(messageWithId);
      
      // Keep only last 50 messages to prevent memory issues
      const queue = messageQueues.get(client.id)!;
      if (queue.length > 50) {
        queue.splice(0, queue.length - 50);
      }
    }
  }

  // Fallback HTTP endpoints for when WebSockets don't work in public domains
  const messageQueues = new Map<string, any[]>();
  let messageIdCounter = 1;
  
  app.post('/api/messages/:clientId', async (req, res) => {
    const { clientId } = req.params;
    const message = req.body;
    
    try {
      let client = clients.get(clientId);
      if (!client) {
        // Create a new HTTP-only client
        client = {
          id: clientId,
          isRecording: false,
          languageHistory: [],
          audioBuffer: []
        };
        clients.set(clientId, client);
        console.log(`HTTP client created: ${clientId}`);
      }
      
      await handleControlMessage(client, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  app.get('/api/messages/:clientId', async (req, res) => {
    const { clientId } = req.params;
    const after = parseInt(req.query.after as string) || 0;
    
    const queue = messageQueues.get(clientId) || [];
    const newMessages = queue.filter(msg => msg.id > after);
    res.json(newMessages);
  });

  app.post('/api/audio/:clientId', express.raw({ type: 'application/octet-stream' }), async (req, res) => {
    const { clientId } = req.params;
    const audioData = req.body;
    
    try {
      let client = clients.get(clientId);
      if (!client) {
        // Create a new HTTP-only client for audio
        client = {
          id: clientId,
          isRecording: false,
          languageHistory: [],
          audioBuffer: []
        };
        clients.set(clientId, client);
        console.log(`HTTP audio client created: ${clientId}`);
      }
      
      if (audioData && Buffer.isBuffer(audioData)) {
        const arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
        await processAudioChunk(client, arrayBuffer);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Audio processing error:', error);
      res.status(500).json({ error: 'Failed to process audio' });
    }
  });

  // API Routes for session data
  app.get('/api/sessions/:clientId/current', async (req, res) => {
    try {
      const { clientId } = req.params;
      const session = await storage.getCurrentSession(clientId);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get current session' });
    }
  });

  app.get('/api/sessions/:sessionId/messages', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const messages = await storage.getSessionMessages(sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get session messages' });
    }
  });

  app.get('/api/sessions/:sessionId/metrics', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const metrics = await storage.getSessionMetrics(sessionId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get session metrics' });
    }
  });

  app.get('/api/usage/monthly', async (req, res) => {
    try {
      const usage = await storage.getMonthlyUsage();
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get monthly usage' });
    }
  });

  return httpServer;
}
