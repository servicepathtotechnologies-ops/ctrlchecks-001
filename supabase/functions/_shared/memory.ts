// Hybrid Memory Service for CtrlChecks AI
// Combines Redis (short-term, fast) + PostgreSQL (long-term, semantic search)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRedisClient, isRedisAvailable } from "./redis-client.ts";

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface MemoryConfig {
  type: 'redis' | 'vector' | 'hybrid';
  ttl?: number; // Time to live in seconds (for Redis)
  maxMessages?: number; // Maximum messages to retrieve
}

export class HybridMemoryService {
  private supabase: any;
  private config: MemoryConfig;
  private redisAvailable: boolean = false;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: MemoryConfig = { type: 'hybrid', ttl: 3600, maxMessages: 100 }
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = config;
  }

  /**
   * Initialize the memory service
   * Checks Redis availability and sets up connections
   */
  async initialize(): Promise<void> {
    this.redisAvailable = await isRedisAvailable();
    if (!this.redisAvailable && this.config.type === 'redis') {
      console.warn("Redis not available, falling back to PostgreSQL");
    }
  }

  /**
   * Store a message in memory
   */
  async store(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const message: MemoryMessage = { role, content, timestamp, metadata };

    // Store in Redis if available and configured
    if (this.redisAvailable && (this.config.type === 'redis' || this.config.type === 'hybrid')) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const redisKey = `memory:${sessionId}:${Date.now()}`;
          const ttl = this.config.ttl || 3600;
          
          // Store individual message with TTL
          await redis.setex(redisKey, ttl, JSON.stringify(message));
          
          // Add to recent list (for fast retrieval)
          await redis.lpush(`memory:${sessionId}:recent`, JSON.stringify(message));
          await redis.ltrim(`memory:${sessionId}:recent`, 0, (this.config.maxMessages || 100) - 1);
        }
      } catch (error) {
        console.error("Error storing in Redis:", error);
        // Continue to PostgreSQL storage
      }
    }

    // Store in PostgreSQL (long-term, semantic search)
    if (this.config.type === 'vector' || this.config.type === 'hybrid') {
      try {
        // Ensure session exists
        await this.ensureSession(sessionId);

        // Store message (embedding generation can be added later)
        const { error } = await this.supabase
          .from('memory_messages')
          .insert({
            session_id: sessionId,
            role,
            content,
            metadata: metadata || {},
            // embedding: await this.generateEmbedding(content), // Future: Add embedding
          });

        if (error) {
          console.error('Error storing memory in PostgreSQL:', error);
          // Don't fail completely if PostgreSQL fails
        }
      } catch (error) {
        console.error('Error in PostgreSQL storage:', error);
      }
    }
  }

  /**
   * Retrieve messages from memory
   */
  async retrieve(sessionId: string, limit: number = 10): Promise<MemoryMessage[]> {
    const messages: MemoryMessage[] = [];
    const maxLimit = limit || this.config.maxMessages || 10;

    // Get from Redis first (recent messages, fast)
    if (this.redisAvailable && (this.config.type === 'redis' || this.config.type === 'hybrid')) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const recent = await redis.lrange(`memory:${sessionId}:recent`, 0, maxLimit - 1);
          for (const msg of recent) {
            try {
              messages.push(JSON.parse(msg));
            } catch (e) {
              console.error("Error parsing Redis message:", e);
            }
          }
        }
      } catch (error) {
        console.error("Error retrieving from Redis:", error);
      }
    }

    // Get from PostgreSQL if needed (older context, semantic search)
    if (messages.length < maxLimit && (this.config.type === 'vector' || this.config.type === 'hybrid')) {
      try {
        const { data, error } = await this.supabase
          .from('memory_messages')
          .select('role, content, created_at, metadata')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(maxLimit - messages.length);

        if (!error && data) {
          // Add older messages (avoid duplicates)
          const existingContents = new Set(messages.map(m => m.content));
          for (const msg of data.reverse()) {
            if (!existingContents.has(msg.content)) {
              messages.push({
                role: msg.role,
                content: msg.content,
                timestamp: msg.created_at,
                metadata: msg.metadata,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error retrieving from PostgreSQL:", error);
      }
    }

    // Sort by timestamp (oldest first for conversation context)
    return messages
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      })
      .slice(0, maxLimit);
  }

  /**
   * Clear all messages for a session
   */
  async clear(sessionId: string): Promise<void> {
    // Clear Redis
    if (this.redisAvailable) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const keys = await redis.keys(`memory:${sessionId}:*`);
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        }
      } catch (error) {
        console.error("Error clearing Redis:", error);
      }
    }

    // Clear PostgreSQL
    try {
      const { error } = await this.supabase
        .from('memory_messages')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error clearing PostgreSQL memory:', error);
      }
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  }

  /**
   * Search messages using text search (future: semantic search with embeddings)
   */
  async search(
    sessionId: string,
    query: string,
    limit: number = 5
  ): Promise<Array<MemoryMessage & { score?: number }>> {
    try {
      // Use PostgreSQL full-text search
      const { data, error } = await this.supabase
        .from('memory_messages')
        .select('role, content, created_at, metadata')
        .eq('session_id', sessionId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error searching memory:', error);
        return [];
      }

      return (data || []).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        metadata: msg.metadata,
      }));
    } catch (error) {
      console.error('Error in memory search:', error);
      return [];
    }
  }

  /**
   * Ensure memory session exists in database
   */
  private async ensureSession(sessionId: string): Promise<void> {
    try {
      // Try to get session
      const { data, error } = await this.supabase
        .from('memory_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      // If session doesn't exist, we'll create it when we have workflow_id
      // For now, we'll skip creation if it doesn't exist
      // In production, you'd want to pass workflow_id here
      if (error && error.code === 'PGRST116') {
        // Session doesn't exist, but that's okay for now
        // It will be created when workflow_id is available
      }
    } catch (error) {
      console.error('Error ensuring session:', error);
    }
  }

  /**
   * Create or get memory session
   */
  async getOrCreateSession(
    workflowId: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    try {
      // Check if session exists
      const { data: existing } = await this.supabase
        .from('memory_sessions')
        .select('session_id')
        .eq('session_id', sessionId)
        .eq('workflow_id', workflowId)
        .single();

      if (existing) {
        return sessionId;
      }

      // Create new session
      const { data, error } = await this.supabase
        .from('memory_sessions')
        .insert({
          workflow_id: workflowId,
          session_id: sessionId,
          user_id: userId || null,
        })
        .select('session_id')
        .single();

      if (error) {
        console.error('Error creating memory session:', error);
        return sessionId; // Return original sessionId even if DB insert fails
      }

      return data.session_id;
    } catch (error) {
      console.error('Error in getOrCreateSession:', error);
      return sessionId;
    }
  }
}

