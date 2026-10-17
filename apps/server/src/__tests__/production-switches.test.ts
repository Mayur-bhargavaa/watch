import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every TEST-ONLY environment switch must be ignored when NODE_ENV=production. Engine timers are read at import time, so the check runs
// in a child process with the switches set (module state cannot be reset in-process).
const here = path.dirname(fileURLToPath(import.meta.url));
const SWITCHES = {
  IMPOSTER_TEST_MIN_PLAYERS: '2', MAFIA_TEST_MIN_PLAYERS: '2', MURDER_TEST_MIN_PLAYERS: '2', TOURNAMENT_TEST_MIN_PLAYERS: '2',
  IMPOSTER_REVEAL_MS: '200', MAFIA_REVEAL_MS: '200', QUIZ_INTRO_MS: '200', QUIZ_REVEAL_MS: '200',
  EMOJI_CHARADES_COUNTDOWN_MS: '200', MURDER_REVEAL_MS: '200', MURDER_RESULT_MS: '200', BILLING_MODE: 'mock', BILLING_TEST_USERS: 'a@b.com,u1'
};
const probe = `
  import { imposterMinPlayers, IMPOSTER_TIMING } from ${JSON.stringify(path.join(here, '../games/ImposterEngine.ts'))};
  import { mafiaMinPlayers, MAFIA_TIMING } from ${JSON.stringify(path.join(here, '../games/MafiaNightEngine.ts'))};
  import { murderMinPlayers, MURDER_TIMING } from ${JSON.stringify(path.join(here, '../games/MurderMysteryEngine.ts'))};
  import { tournamentMinPlayers } from ${JSON.stringify(path.join(here, '../games/TournamentEngine.ts'))};
  import { QUIZ_TIMING } from ${JSON.stringify(path.join(here, '../games/QuizShowEngine.ts'))};
  import { EMOJI_CHARADES_TIMING } from ${JSON.stringify(path.join(here, '../games/EmojiCharadesEngine.ts'))};
  import { mockEnabled, testModeOn, testBypassFor } from ${JSON.stringify(path.join(here, '../services/billing.ts'))};
  console.log(JSON.stringify({
    mins: [imposterMinPlayers(), mafiaMinPlayers(), murderMinPlayers(), tournamentMinPlayers()],
    timers: [IMPOSTER_TIMING.revealMs, MAFIA_TIMING.revealMs, QUIZ_TIMING.introMs, QUIZ_TIMING.revealMs, EMOJI_CHARADES_TIMING.countdownMs, MURDER_TIMING],
    billing: [mockEnabled(), testModeOn(), testBypassFor({ id: 'u1', email: 'a@b.com' })]
  }));
`;
function run(nodeEnv: string) {
  const out = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', probe], {
    cwd: path.join(here, '../..'), encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, ...SWITCHES, NODE_ENV: nodeEnv, MONGODB_URI: 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=300' }
  });
  return JSON.parse(out.trim().split('\n').pop()!);
}

test('production ignores every test-only switch (min players, phase timers, mock billing, billing test users)', () => {
  const prod = run('production');
  assert.deepEqual(prod.mins, [4, 5, 6, 4]);
  assert.ok(prod.timers.slice(0, 5).every((ms: number) => ms >= 1000), `a shortened timer leaked into production: ${JSON.stringify(prod.timers)}`);
  assert.ok(prod.timers[5].revealMs >= 1000 && prod.timers[5].resultMs >= 1000, 'murder timers');
  assert.deepEqual(prod.billing, [false, false, false]);
});

test('outside production the same switches DO apply (proves the probe is sensitive)', () => {
  const dev = run('development');
  assert.deepEqual(dev.mins, [2, 2, 2, 2]);
  assert.equal(dev.timers[0], 200);
  assert.equal(dev.timers[5].revealMs, 200);
  assert.deepEqual(dev.billing, [true, true, true]);
});

test('boot refuses MAIL_TRANSPORT=memory in production (source guard; the full boot needs the dynamic harness)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(path.join(here, '../index.ts'), 'utf8');
  assert.match(src, /IS_PROD && process\.env\.MAIL_TRANSPORT === 'memory'[\s\S]{0,120}throw new Error/);
});
