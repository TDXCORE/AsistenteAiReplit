import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const voiceSessions = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  messageCount: integer("message_count").default(0),
  totalCost: real("total_cost").default(0),
  avgLatency: real("avg_latency"), // in milliseconds
});

export const conversationMessages = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  messageType: text("message_type").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  latency: real("latency"), // response latency in ms
  confidence: real("confidence"), // STT confidence 0-1
  language: text("language"), // detected language code
  cost: real("cost").default(0), // individual message cost
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  audioCaptureLatency: real("audio_capture_latency"),
  networkUpLatency: real("network_up_latency"),
  sttLatency: real("stt_latency"),
  llmLatency: real("llm_latency"),
  ttsLatency: real("tts_latency"),
  networkDownLatency: real("network_down_latency"),
  totalLatency: real("total_latency"),
  audioLevel: real("audio_level"),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => voiceSessions.id),
  service: text("service").notNull(), // 'deepgram' | 'groq' | 'elevenlabs'
  requestCount: integer("request_count").default(1),
  cost: real("cost").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertVoiceSessionSchema = createInsertSchema(voiceSessions).omit({
  id: true,
  startTime: true,
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  timestamp: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
  timestamp: true,
});

export type VoiceSession = typeof voiceSessions.$inferSelect;
export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
