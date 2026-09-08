import { MongoClient } from 'mongodb';
export class MongoLoggerService {
    client = null;
    db = null;
    collection = null;
    isConnected = false;
    logBuffer = [];
    defaultUri = 'mongodb+srv://DBmayur:Mayur%402608@cluster0.ytcpzbb.mongodb.net/';
    constructor() {
        this.init();
    }
    async init() {
        try {
            if (typeof process.loadEnvFile === 'function') {
                process.loadEnvFile();
            }
        }
        catch { }
        const uri = process.env.MONGODB_URI || this.defaultUri;
        try {
            this.client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 3000,
                connectTimeoutMS: 3000
            });
            await this.client.connect();
            this.db = this.client.db('stitchbyte_watch_party');
            this.collection = this.db.collection('party_activity_logs');
            this.isConnected = true;
            console.log('🍃 MongoDB Activity Logger connected successfully to cluster0.ytcpzbb.mongodb.net');
            // Flush buffered logs if any were queued before connection established
            if (this.logBuffer.length > 0) {
                await this.collection.insertMany(this.logBuffer);
                this.logBuffer = [];
            }
        }
        catch (err) {
            this.isConnected = false;
            console.log(`🍃 [MongoLogger] Notice: Remote MongoDB offline or unauthenticated (${err.message || err}). Activity logs buffered locally.`);
        }
    }
    async logEvent(type, data) {
        const entry = {
            type,
            timestamp: new Date().toISOString(),
            epochMs: Date.now(),
            data
        };
        if (this.isConnected && this.collection) {
            try {
                await this.collection.insertOne(entry);
            }
            catch (err) {
                this.logBuffer.push(entry);
            }
        }
        else {
            this.logBuffer.push(entry);
            if (this.logBuffer.length > 500) {
                this.logBuffer.shift(); // Keep bounded memory
            }
        }
    }
    // Convenience methods
    async logAuthLogin(userId, email, displayName) {
        await this.logEvent('AUTH_LOGIN', { userId, email, displayName });
    }
    async logAuthRegister(userId, email, displayName) {
        await this.logEvent('AUTH_REGISTER', { userId, email, displayName });
    }
    async logRoomCreated(roomId, slug, hostId, title, activityMode) {
        await this.logEvent('ROOM_CREATED', { roomId, slug, hostId, title, activityMode });
    }
    async logUserJoined(roomId, userId, displayName, role) {
        await this.logEvent('USER_JOINED', { roomId, userId, displayName, role });
    }
    async logUserLeft(roomId, userId, reason) {
        await this.logEvent('USER_LEFT', { roomId, userId, reason });
    }
    async logGameEvent(roomId, userId, gameType, action, details) {
        await this.logEvent('GAME_ACTIVITY', { roomId, userId, gameType, action, details });
    }
    async logPlaybackCommand(roomId, userId, action, position) {
        await this.logEvent('PLAYBACK_COMMAND', { roomId, userId, action, position });
    }
    async close() {
        if (this.client) {
            try {
                await this.client.close();
            }
            catch { }
            this.isConnected = false;
        }
    }
}
export const mongoLogger = new MongoLoggerService();
