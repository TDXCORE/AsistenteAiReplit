import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, gte } from "drizzle-orm";
import { 
  voiceSessions, 
  conversationMessages, 
  performanceMetrics, 
  apiUsage,
  type VoiceSession, 
  type InsertVoiceSession,
  type ConversationMessage,
  type InsertConversationMessage,
  type PerformanceMetric,
  type InsertPerformanceMetric,
  type ApiUsage,
  type InsertApiUsage
} from "@shared/schema";

export interface IStorage {
  // Voice sessions
  createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession>;
  getCurrentSession(clientId: string): Promise<VoiceSession | undefined>;
  updateSession(id: number, updates: Partial<VoiceSession>): Promise<VoiceSession>;

  // Conversation messages
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getSessionMessages(sessionId: number): Promise<ConversationMessage[]>;

  // Performance metrics
  createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric>;
  getSessionMetrics(sessionId: number): Promise<PerformanceMetric[]>;

  // API usage
  createApiUsage(usage: InsertApiUsage): Promise<ApiUsage>;
  getMonthlyUsage(): Promise<any>;
}

export class MemStorage implements IStorage {
  private sessions: Map<number, VoiceSession>;
  private messages: Map<number, ConversationMessage>;
  private metrics: Map<number, PerformanceMetric>;
  private usage: Map<number, ApiUsage>;
  private currentId: number;

  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
    this.metrics = new Map();
    this.usage = new Map();
    this.currentId = 1;
  }

  async createVoiceSession(insertSession: InsertVoiceSession): Promise<VoiceSession> {
    const id = this.currentId++;
    const session: VoiceSession = {
      ...insertSession,
      id,
      startTime: new Date(),
      endTime: null,
      duration: null,
      messageCount: 0,
      totalCost: 0,
      avgLatency: null,
    };
    this.sessions.set(id, session);
    return session;
  }

  async getCurrentSession(clientId: string): Promise<VoiceSession | undefined> {
    return Array.from(this.sessions.values()).find(
      session => session.clientId === clientId && !session.endTime
    );
  }

  async updateSession(id: number, updates: Partial<VoiceSession>): Promise<VoiceSession> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error('Session not found');
    }
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async createConversationMessage(insertMessage: InsertConversationMessage): Promise<ConversationMessage> {
    const id = this.currentId++;
    const message: ConversationMessage = {
      id,
      timestamp: new Date(),
      sessionId: insertMessage.sessionId ?? null,
      messageType: insertMessage.messageType,
      content: insertMessage.content,
      latency: insertMessage.latency ?? null,
      confidence: insertMessage.confidence ?? null,
      language: insertMessage.language ?? null,
      cost: insertMessage.cost ?? null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getSessionMessages(sessionId: number): Promise<ConversationMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createPerformanceMetric(insertMetric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const id = this.currentId++;
    const metric: PerformanceMetric = {
      id,
      timestamp: new Date(),
      sessionId: insertMetric.sessionId ?? null,
      audioCaptureLatency: insertMetric.audioCaptureLatency ?? null,
      networkUpLatency: insertMetric.networkUpLatency ?? null,
      sttLatency: insertMetric.sttLatency ?? null,
      llmLatency: insertMetric.llmLatency ?? null,
      ttsLatency: insertMetric.ttsLatency ?? null,
      networkDownLatency: insertMetric.networkDownLatency ?? null,
      totalLatency: insertMetric.totalLatency ?? null,
      audioLevel: insertMetric.audioLevel ?? null,
    };
    this.metrics.set(id, metric);
    return metric;
  }

  async getSessionMetrics(sessionId: number): Promise<PerformanceMetric[]> {
    return Array.from(this.metrics.values())
      .filter(metric => metric.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createApiUsage(insertUsage: InsertApiUsage): Promise<ApiUsage> {
    const id = this.currentId++;
    const usage: ApiUsage = {
      id,
      timestamp: new Date(),
      sessionId: insertUsage.sessionId ?? null,
      cost: insertUsage.cost,
      service: insertUsage.service,
      requestCount: insertUsage.requestCount ?? null,
    };
    this.usage.set(id, usage);
    return usage;
  }

  async getMonthlyUsage(): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyUsage = Array.from(this.usage.values())
      .filter(usage => usage.timestamp >= startOfMonth);

    const totalCost = monthlyUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0);
    const sttCost = monthlyUsage
      .filter(usage => usage.service === 'deepgram')
      .reduce((sum, usage) => sum + (usage.cost || 0), 0);
    const llmCost = monthlyUsage
      .filter(usage => usage.service === 'groq')
      .reduce((sum, usage) => sum + (usage.cost || 0), 0);
    const ttsCost = monthlyUsage
      .filter(usage => usage.service === 'elevenlabs')
      .reduce((sum, usage) => sum + (usage.cost || 0), 0);

    const totalSessions = new Set(monthlyUsage.map(usage => usage.sessionId)).size;

    return {
      monthlySpend: totalCost,
      budgetLimit: 50,
      sttCost,
      llmCost,
      ttsCost,
      totalSessions,
      totalMinutes: totalSessions * 2.5, // Estimated average
      avgCostPerConversation: totalSessions > 0 ? totalCost / totalSessions : 0,
    };
  }
}

// Database storage implementation
class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    // Convert Supabase URL to PostgreSQL connection string
    let dbUrl = process.env.DATABASE_URL;
    if (dbUrl.startsWith('https://')) {
      // Extract components from Supabase URL
      const url = new URL(dbUrl);
      const host = url.hostname;
      const password = url.searchParams.get('password') || '';
      dbUrl = `postgresql://postgres:${password}@${host}:5432/postgres`;
    }
    
    const sql = postgres(dbUrl, { ssl: 'require' });
    this.db = drizzle(sql);
  }

  async createVoiceSession(insertSession: InsertVoiceSession): Promise<VoiceSession> {
    const [session] = await this.db.insert(voiceSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getCurrentSession(clientId: string): Promise<VoiceSession | undefined> {
    const sessions = await this.db.select()
      .from(voiceSessions)
      .where(eq(voiceSessions.clientId, clientId))
      .orderBy(desc(voiceSessions.startTime))
      .limit(1);
    return sessions[0];
  }

  async updateSession(id: number, updates: Partial<VoiceSession>): Promise<VoiceSession> {
    const [session] = await this.db.update(voiceSessions)
      .set(updates)
      .where(eq(voiceSessions.id, id))
      .returning();
    return session;
  }

  async createConversationMessage(insertMessage: InsertConversationMessage): Promise<ConversationMessage> {
    const [message] = await this.db.insert(conversationMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getSessionMessages(sessionId: number): Promise<ConversationMessage[]> {
    return await this.db.select()
      .from(conversationMessages)
      .where(eq(conversationMessages.sessionId, sessionId))
      .orderBy(desc(conversationMessages.timestamp));
  }

  async createPerformanceMetric(insertMetric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [metric] = await this.db.insert(performanceMetrics)
      .values(insertMetric)
      .returning();
    return metric;
  }

  async getSessionMetrics(sessionId: number): Promise<PerformanceMetric[]> {
    return await this.db.select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.sessionId, sessionId))
      .orderBy(performanceMetrics.timestamp);
  }

  async createApiUsage(insertUsage: InsertApiUsage): Promise<ApiUsage> {
    const [usage] = await this.db.insert(apiUsage)
      .values(insertUsage)
      .returning();
    return usage;
  }

  async getMonthlyUsage(): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const usage = await this.db.select()
      .from(apiUsage)
      .where(gte(apiUsage.timestamp, startOfMonth));

    const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);
    const serviceBreakdown = usage.reduce((acc, u) => {
      acc[u.service] = (acc[u.service] || 0) + u.cost;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCost,
      serviceBreakdown,
      usage
    };
  }
}

// Use in-memory storage for now due to database connection issues
export const storage = new MemStorage();
