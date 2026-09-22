import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/synccinema';

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const friendshipsCol = db.collection('friendships');

  const all = await friendshipsCol.find({}).toArray();
  console.log(`Total friendships records: ${all.length}`);

  const seenPairs = new Set();
  const duplicateIds = [];

  for (const f of all) {
    console.log('Record:', JSON.stringify(f));
    const u1 = f.userId1 || (f.userIds && f.userIds[0]);
    const u2 = f.userId2 || (f.userIds && f.userIds[1]);
    const pair = [u1, u2].sort().join(':');
    if (seenPairs.has(pair)) {
      duplicateIds.push(f._id);
    } else {
      seenPairs.add(pair);
    }
  }

  if (duplicateIds.length > 0) {
    console.log(`Deleting ${duplicateIds.length} duplicate friendships:`, duplicateIds);
    await friendshipsCol.deleteMany({ _id: { $in: duplicateIds } });
    console.log('Duplicate friendships successfully deleted.');
  } else {
    console.log('No duplicate friendships found.');
  }

  await client.close();
}

run().catch(console.error);
