import type { Express } from "express";
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
  startTime?: number;
  deepgramConnection?: any;
  currentTranscript?: string;
  audioBuffer?: ArrayBuffer[];
}

const clients = new Map<string, ClientConnection>();

// Message schemas for WebSocket communication
const controlMessageSchema = z.object({
  type: z.enum(['start_recording', 'stop_recording', 'interrupt', 'ping', 'settings_update', 'run_integration_test']),
  timestamp: z.number(),
  data: z.any().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const wsType = url.searchParams.get('type'); // 'control' or 'audio'

    if (!clientId) {
      ws.close(1008, 'Client ID required');
      return;
    }

    console.log(`WebSocket ${wsType} connection for client: ${clientId}`);

    // Get or create client connection
    let client = clients.get(clientId);
    if (!client) {
      client = {
        id: clientId,
        isRecording: false,
      };
      clients.set(clientId, client);
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
        if (client!.isRecording && data instanceof ArrayBuffer) {
          await processAudioChunk(client!, data);
        }
      });
    }

    ws.on('close', () => {
      console.log(`WebSocket ${wsType} disconnected for client: ${clientId}`);
      if (wsType === 'control') {
        client!.controlWs = undefined;
      } else if (wsType === 'audio') {
        client!.audioWs = undefined;
      }

      // Clean up client if both connections are closed
      if (!client!.controlWs && !client!.audioWs) {
        clients.delete(clientId);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket ${wsType} error for client ${clientId}:`, error);
    });
  });

  // Handle control messages
  async function handleControlMessage(client: ClientConnection, message: any) {
    const { type, timestamp, data } = message;

    switch (type) {
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
                if (transcriptData.is_final && transcriptData.transcript && transcriptData.transcript.trim().length > 3) {
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

  // Handle transcript updates from Deepgram
  function handleTranscriptUpdate(client: ClientConnection, transcriptData: any) {
    const { transcript, is_final, confidence } = transcriptData;
    
    console.log(`Transcript update for client ${client.id}: "${transcript}" (final: ${is_final}, confidence: ${confidence})`);
    
    if (is_final) {
      client.currentTranscript = transcript;
      console.log(`Final transcript saved for client ${client.id}: "${transcript}"`);
      
      sendControlMessage(client, {
        type: 'transcript_update',
        timestamp: Date.now(),
        transcript,
        isFinal: true,
        confidence,
        language: 'en-US',
      });
    } else {
      sendControlMessage(client, {
        type: 'transcript_update',
        timestamp: Date.now(),
        transcript,
        isFinal: false,
        confidence,
        language: 'en-US',
      });
    }
  }

  // Process audio chunks - stream to Deepgram
  async function processAudioChunk(client: ClientConnection, audioData: ArrayBuffer) {
    console.log(`Processing audio chunk for client ${client.id}: ${audioData.byteLength} bytes`);
    
    if (client.isRecording && client.deepgramConnection) {
      // Send audio data to Deepgram for real-time transcription
      try {
        deepgramService.sendAudioData(client.id, audioData);
        console.log(`Sent audio data to Deepgram for client ${client.id}`);
      } catch (error) {
        console.error(`Failed to send audio to Deepgram for client ${client.id}:`, error);
      }
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
    console.log(`Starting voice processing pipeline for client ${client.id} with transcript: "${transcript}"`);
    const startTime = Date.now();
    const sttLatency = Date.now() - (client.startTime || Date.now());

    try {
      // Step 1: Generate LLM response
      console.log(`Generating LLM response for client ${client.id}`);
      const llmStartTime = Date.now();
      const response = await groqService.generateResponse(transcript);
      const llmLatency = Date.now() - llmStartTime;
      console.log(`LLM response generated in ${llmLatency}ms: "${response}"`);

      // Step 2: Generate TTS audio
      console.log(`Generating TTS audio for client ${client.id}`);
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
          language: 'en-US',
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
        client.audioWs.send(audioBuffer);
      }

    } catch (error) {
      console.error('Voice processing pipeline error:', error);
      sendControlMessage(client, {
        type: 'error',
        timestamp: Date.now(),
        error: 'Failed to process voice request',
      });
    }
  }



  // Send control message to client
  function sendControlMessage(client: ClientConnection, message: any) {
    if (client.controlWs && client.controlWs.readyState === WebSocket.OPEN) {
      client.controlWs.send(JSON.stringify(message));
    }
  }

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
