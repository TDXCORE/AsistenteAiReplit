import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { insertConversationMessageSchema, insertPerformanceMetricSchema, insertApiUsageSchema } from "@shared/schema";

interface ClientConnection {
  id: string;
  controlWs?: WebSocket;
  audioWs?: WebSocket;
  sessionId?: number;
  isRecording: boolean;
  startTime?: number;
}

const clients = new Map<string, ClientConnection>();

// Message schemas for WebSocket communication
const controlMessageSchema = z.object({
  type: z.enum(['start_recording', 'stop_recording', 'interrupt', 'ping', 'settings_update']),
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
          
          // Create new session if needed
          if (!client.sessionId) {
            const session = await storage.createVoiceSession({
              clientId: client.id,
            });
            client.sessionId = session.id;
          }

          sendControlMessage(client, {
            type: 'recording_started',
            timestamp: Date.now(),
          });
        }
        break;

      case 'stop_recording':
        if (client.isRecording) {
          client.isRecording = false;
          
          // Simulate processing and response generation
          await simulateVoiceProcessing(client);
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
    }
  }

  // Process audio chunks (simplified for this implementation)
  async function processAudioChunk(client: ClientConnection, audioData: ArrayBuffer) {
    // In a real implementation, this would:
    // 1. Stream audio to STT service (Deepgram)
    // 2. Accumulate transcript
    // 3. Detect voice activity
    // 4. Send real-time transcript updates

    // For now, simulate audio level detection
    const audioLevel = Math.random() * 100;
    
    sendControlMessage(client, {
      type: 'audio_level',
      timestamp: Date.now(),
      level: audioLevel,
    });
  }

  // Simulate the complete voice processing pipeline
  async function simulateVoiceProcessing(client: ClientConnection) {
    const startTime = Date.now();
    
    // Simulate STT processing
    setTimeout(() => {
      sendControlMessage(client, {
        type: 'transcript_update',
        timestamp: Date.now(),
        transcript: "How's the weather looking for tomorrow?",
        isFinal: true,
        confidence: 0.98,
        language: 'en-US',
      });
    }, 150);

    // Simulate LLM processing and response
    setTimeout(async () => {
      const responseLatency = Date.now() - startTime;
      
      // Save conversation message
      if (client.sessionId) {
        await storage.createConversationMessage({
          sessionId: client.sessionId,
          messageType: 'user',
          content: "How's the weather looking for tomorrow?",
          latency: responseLatency,
          confidence: 0.98,
          language: 'en-US',
          cost: 0.002,
        });

        await storage.createConversationMessage({
          sessionId: client.sessionId,
          messageType: 'assistant',
          content: "Tomorrow in your area looks quite pleasant! You can expect partly cloudy skies with a high of 72°F and a low of 55°F. There's only a 10% chance of rain, so it should be a great day for any outdoor activities you have planned.",
          latency: responseLatency,
          cost: 0.008,
        });

        // Save performance metrics
        await storage.createPerformanceMetric({
          sessionId: client.sessionId,
          audioCaptureLatency: 28,
          networkUpLatency: 45,
          sttLatency: 89,
          llmLatency: 124,
          ttsLatency: 380,
          networkDownLatency: 32,
          totalLatency: responseLatency,
          audioLevel: 65,
        });

        // Save API usage
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

      sendControlMessage(client, {
        type: 'response_ready',
        timestamp: Date.now(),
        response: {
          text: "Tomorrow in your area looks quite pleasant! You can expect partly cloudy skies with a high of 72°F and a low of 55°F. There's only a 10% chance of rain, so it should be a great day for any outdoor activities you have planned.",
          latency: responseLatency,
        },
      });

      // Simulate TTS audio response
      setTimeout(() => {
        if (client.audioWs && client.audioWs.readyState === WebSocket.OPEN) {
          // In real implementation, this would be actual audio data
          const mockAudioData = new ArrayBuffer(1024);
          client.audioWs.send(mockAudioData);
        }
      }, 100);

    }, 250);
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
