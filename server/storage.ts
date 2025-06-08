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
      sessionId: insertMessage.sessionId,
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
      ...insertMetric,
      id,
      timestamp: new Date(),
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
      ...insertUsage,
      id,
      timestamp: new Date(),
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

export const storage = new MemStorage();
