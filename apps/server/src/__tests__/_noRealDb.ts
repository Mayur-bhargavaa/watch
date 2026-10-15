/**
 * Import this FIRST in any test that loads the game code. The Mongo modules call process.loadEnvFile() (reads
 * apps/server/.env, which points at the real Atlas cluster) but never override variables that are already set,
 * so pointing MONGODB_URI at a dead local port guarantees tests cannot reach a real database.
 */
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=300&connectTimeoutMS=300';
/** The dev .env may carry testing-only switches (e.g. IMPOSTER_TEST_MIN_PLAYERS); pin them off so unit tests see the defaults. */
process.env.IMPOSTER_TEST_MIN_PLAYERS = '';
process.env.MAFIA_TEST_MIN_PLAYERS = '';
process.env.MURDER_TEST_MIN_PLAYERS = '';
export {};
