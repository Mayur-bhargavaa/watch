import { MongoClient, Db, Collection } from 'mongodb';

export interface ActivityLogEntry {
  type: string;
  timestamp: string;
  epochMs: number;
  data: Record<string, any>;
}

export class MongoLoggerService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<ActivityLogEntry> | null = null;
  private isConnected: boolean = false;
  private logBuffer: ActivityLogEntry[] = [];
  private readonly defaultUri: string = 'mongodb+srv://DBmayur:Mayur%402608@cluster0.ytcpzbb.mongodb.net/';

  constructor() {
    this.init();
  }

  private async init() {
    try {
      if (typeof (process as any).loadEnvFile === 'function') {
        (process as any).loadEnvFile();
      }
    } catch {}

    const uri = process.env.MONGODB_URI || this.defaultUri;
    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });

      await this.client.connect();
      this.db = this.client.db('stitchbyte_watch_party');
      this.collection = this.db.collection<ActivityLogEntry>('party_activity_logs');
      this.isConnected = true;
      console.log('🍃 MongoDB Activity Logger connected successfully to cluster0.ytcpzbb.mongodb.net');

      // Flush buffered logs if any were queued before connection established
      if (this.logBuffer.length > 0) {
        await this.collection.insertMany(this.logBuffer);
        this.logBuffer = [];
      }
    } catch (err: any) {
      this.isConnected = false;
      console.log(`🍃 [MongoLogger] Notice: Remote MongoDB offline or unauthenticated (${err.message || err}). Activity logs buffered locally.`);
    }
  }

  async logEvent(type: string, data: Record<string, any>): Promise<void> {
    const entry: ActivityLogEntry = {
      type,
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      data
    };

    if (this.isConnected && this.collection) {
      try {
        await this.collection.insertOne(entry);
      } catch (err) {
        this.logBuffer.push(entry);
      }
    } else {
      this.logBuffer.push(entry);
      if (this.logBuffer.length > 500) {
        this.logBuffer.shift(); // Keep bounded memory
      }
    }
  }

  // Convenience methods
  async logAuthLogin(userId: string, email: string, displayName: string): Promise<void> {
    await this.logEvent('AUTH_LOGIN', { userId, email, displayName });
  }

  async logAuthRegister(userId: string, email: string, displayName: string): Promise<void> {
    await this.logEvent('AUTH_REGISTER', { userId, email, displayName });
  }

  async logRoomCreated(roomId: string, slug: string, hostId: string, title: string, activityMode: string): Promise<void> {
    await this.logEvent('ROOM_CREATED', { roomId, slug, hostId, title, activityMode });
  }

  async logUserJoined(roomId: string, userId: string, displayName: string, role: string): Promise<void> {
    await this.logEvent('USER_JOINED', { roomId, userId, displayName, role });
  }

  async logUserLeft(roomId: string, userId: string, reason: string): Promise<void> {
    await this.logEvent('USER_LEFT', { roomId, userId, reason });
  }

  async logGameEvent(roomId: string, userId: string, gameType: string, action: string, details?: any): Promise<void> {
    await this.logEvent('GAME_ACTIVITY', { roomId, userId, gameType, action, details });
  }

  async logPlaybackCommand(roomId: string, userId: string, action: string, position: number): Promise<void> {
    await this.logEvent('PLAYBACK_COMMAND', { roomId, userId, action, position });
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {}
      this.isConnected = false;
    }
  }
}

export const mongoLogger = new MongoLoggerService();
