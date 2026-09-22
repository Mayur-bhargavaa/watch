import { DatabaseSync } from 'node:sqlite';
import { MongoClient } from 'mongodb';

const SQLITE_PATH = process.argv[2] || '/tmp/synccinema.db';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://DBmayur:Mayur%402608@cluster0.ytcpzbb.mongodb.net/';
const DB_NAME = 'stitchbyte_watch_party';

// The only 3 allowed users as instructed:
const ALLOWED_EMAILS = [
  'mayurbhargava026@gmail.com',
  'abcdghijk552@gmail.com',
  'anuraggupta7656@gmail.com'
];

async function runMigration() {
  console.log('🔄 Opening SQLite database at', SQLITE_PATH);
  const sqlite = new DatabaseSync(SQLITE_PATH);

  console.log('🔄 Connecting to MongoDB Atlas...');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const mongo = client.db(DB_NAME);
  console.log(' Connected to MongoDB:', DB_NAME);

  // 1. Collections setup
  const usersCol = mongo.collection('users');
  const directMessagesCol = mongo.collection('direct_messages');
  const friendshipsCol = mongo.collection('friendships');
  const streaksCol = mongo.collection('friend_streaks');
  const plansCol = mongo.collection('plans');

  // Create indexes
  console.log(' Creating MongoDB Indexes...');
  await usersCol.createIndex({ email: 1 }, { unique: true, sparse: true });
  await usersCol.createIndex({ partnerCode: 1 }, { unique: true });
  await directMessagesCol.createIndex({ conversationId: 1, createdAt: 1 });
  await directMessagesCol.createIndex({ recipientId: 1, status: 1 });
  await directMessagesCol.createIndex({ senderId: 1, createdAt: 1 });
  await friendshipsCol.createIndex({ userIds: 1 });
  await streaksCol.createIndex({ userIds: 1 });
  await plansCol.createIndex({ hostId: 1 });

  // 2. Fetch allowed users from SQLite
  const placeholders = ALLOWED_EMAILS.map(() => '?').join(',');
  const userRows = sqlite.prepare(`SELECT * FROM users WHERE email IN (${placeholders})`).all(...ALLOWED_EMAILS);
  console.log(`\n📋 Found ${userRows.length} allowed users in SQLite:`);

  const allowedUserIds = new Set();
  const mongoUsers = [];

  for (const row of userRows) {
    allowedUserIds.add(row.id);
    let favGenres = [];
    try {
      if (row.favorite_genres) favGenres = JSON.parse(row.favorite_genres);
    } catch {}

    const doc = {
      _id: row.id,
      id: row.id,
      email: row.email.toLowerCase(),
      passwordHash: row.password_hash || null,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      partnerCode: row.partner_code,
      isAnonymous: false,
      dateOfBirth: row.date_of_birth || null,
      anniversaryDate: row.anniversary_date || null,
      isMarried: Boolean(row.is_married),
      age: row.age || null,
      relationshipStatus: row.relationship_status || null,
      gender: row.gender || null,
      pronouns: row.pronouns || null,
      location: row.location || null,
      bio: row.bio || null,
      favoriteGenres: favGenres,
      viewingVibe: row.viewing_vibe || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mongoUsers.push(doc);
    console.log(` - [${doc.id}] ${doc.email} (${doc.displayName}, Code: ${doc.partnerCode})`);
  }

  // Clear existing users collection to ensure clean structure with no unwanted users
  await usersCol.deleteMany({});
  if (mongoUsers.length > 0) {
    await usersCol.insertMany(mongoUsers);
    console.log(` Saved ${mongoUsers.length} clean users to MongoDB.`);
  }

  // 3. Friendships
  const friendshipRows = sqlite.prepare(`SELECT * FROM friendships`).all();
  const validFriendships = [];
  for (const f of friendshipRows) {
    if (allowedUserIds.has(f.user_id_1) && allowedUserIds.has(f.user_id_2)) {
      const pair = [f.user_id_1, f.user_id_2].sort();
      validFriendships.push({
        _id: f.id || `fr_${pair.join('_')}`,
        userId1: f.user_id_1,
        userId2: f.user_id_2,
        userIds: pair,
        status: f.status || 'ACCEPTED',
        createdAt: f.created_at || new Date().toISOString(),
        updatedAt: f.updated_at || new Date().toISOString()
      });
    }
  }

  await friendshipsCol.deleteMany({});
  if (validFriendships.length > 0) {
    await friendshipsCol.insertMany(validFriendships);
    console.log(` Saved ${validFriendships.length} friendships between allowed users.`);
  }

  // 4. Friend Streaks
  const streakRows = sqlite.prepare(`SELECT * FROM friend_streaks`).all();
  const validStreaks = [];
  for (const s of streakRows) {
    if (allowedUserIds.has(s.user_id_1) && allowedUserIds.has(s.user_id_2)) {
      const pair = [s.user_id_1, s.user_id_2].sort();
      validStreaks.push({
        _id: s.id || `stk_${pair.join('_')}`,
        userId1: s.user_id_1,
        userId2: s.user_id_2,
        userIds: pair,
        currentStreak: s.current_streak || 0,
        longestStreak: s.longest_streak || 0,
        lastWatchedDate: s.last_watched_date || null,
        totalMinutesWatched: s.total_minutes_watched || 0,
        createdAt: s.created_at || new Date().toISOString(),
        updatedAt: s.updated_at || new Date().toISOString()
      });
    }
  }

  await streaksCol.deleteMany({});
  if (validStreaks.length > 0) {
    await streaksCol.insertMany(validStreaks);
    console.log(` Saved ${validStreaks.length} streaks between allowed users.`);
  }

  // 5. Direct Messages between Mayur and abcdghijk552
  const mayurId = 'usr_hN35KGS9RX';
  const abcdId = 'usr_8AXgqfs41n';
  const canonicalConvId = `conv_${[mayurId, abcdId].sort().join('_')}`;

  const messageRows = sqlite.prepare(`
    SELECT * FROM direct_chat_messages
    WHERE (sender_id IN ('${mayurId}', '${abcdId}'))
      AND (recipient_id IN ('${mayurId}', '${abcdId}') OR conversation_id LIKE '%${mayurId}%${abcdId}%' OR conversation_id LIKE '%${abcdId}%${mayurId}%')
    ORDER BY created_at ASC
  `).all();

  console.log(`\n Found ${messageRows.length} messages between Mayur & abcdghijk552.`);

  const mongoMessages = [];
  const seenIds = new Set();

  for (const m of messageRows) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);

    let metadata = undefined;
    let replyTo = undefined;
    try {
      if (m.metadata) metadata = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
    } catch {}
    try {
      if (m.reply_to) replyTo = typeof m.reply_to === 'string' ? JSON.parse(m.reply_to) : m.reply_to;
    } catch {}

    const recipient = (m.recipient_id === mayurId || m.recipient_id === abcdId)
      ? m.recipient_id
      : (m.sender_id === mayurId ? abcdId : mayurId);

    mongoMessages.push({
      _id: m.id,
      id: m.id,
      conversationId: canonicalConvId,
      senderId: m.sender_id,
      senderName: m.sender_name || (m.sender_id === mayurId ? 'Mayur Bhargava' : 'abcdghijk552'),
      senderAvatar: m.sender_avatar || null,
      recipientId: recipient,
      type: m.type || 'text',
      content: m.content || '',
      mediaUrl: m.media_url || null,
      metadata: metadata || null,
      replyTo: replyTo || null,
      status: m.status || 'read',
      isDeleted: Boolean(m.is_deleted),
      createdAt: m.created_at || new Date().toISOString()
    });
  }

  await directMessagesCol.deleteMany({ conversationId: canonicalConvId });
  if (mongoMessages.length > 0) {
    await directMessagesCol.insertMany(mongoMessages);
    console.log(` Saved ${mongoMessages.length} direct messages to MongoDB.`);
  }

  // 6. Plans
  const planRows = sqlite.prepare(`SELECT * FROM plans`).all();
  const mongoPlans = [];
  for (const p of planRows) {
    if (allowedUserIds.has(p.host_id)) {
      let activities = [];
      let participants = [];
      try { if (p.activities) activities = JSON.parse(p.activities); } catch {}
      try { if (p.participants) participants = JSON.parse(p.participants); } catch {}

      mongoPlans.push({
        _id: p.id,
        id: p.id,
        hostId: p.host_id,
        title: p.title,
        emoji: p.emoji,
        type: p.type,
        date: p.date,
        dateFormatted: p.date_formatted,
        time: p.time,
        endTime: p.end_time,
        timezone: p.timezone,
        description: p.description,
        activities,
        participants,
        createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
        isPast: Boolean(p.is_past)
      });
    }
  }

  await plansCol.deleteMany({});
  if (mongoPlans.length > 0) {
    await plansCol.insertMany(mongoPlans);
    console.log(` Saved ${mongoPlans.length} plans to MongoDB.`);
  }

  console.log('\n🎉 MIGRATION TO MONGODB ATLAS COMPLETE!');
  await client.close();
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
