import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGameLaunchEmail, GAME_EMAILS } from '../lib/game-launch-email.mjs';

const sender = { companyName: 'Acme Ltd', address: '1 Main St', contactEmail: 'help@acme.test' };

test('renders subject, text and html with the game link and the reason line', () => {
  for (const gameId of Object.keys(GAME_EMAILS)) {
    const m = renderGameLaunchEmail({ gameId, name: 'Alex Smith', webBase: 'https://watch.example/', sender });
    assert.match(m.subject, new RegExp(GAME_EMAILS[gameId].title));
    assert.equal(m.url, `https://watch.example${GAME_EMAILS[gameId].path}`);
    assert.ok(m.text.includes(m.url) && m.html.includes(m.url));
    assert.match(m.text, /Hi Alex,/);
    assert.match(m.text, /tapped "Notify me"/);
    assert.ok(m.text.includes('Acme Ltd') && m.html.includes('help@acme.test'));
  }
});

test('escapes user-controlled names and has no remote images or scripts', () => {
  const m = renderGameLaunchEmail({ gameId: 'imposter', name: '<img src=x onerror=1>', webBase: 'https://w.test', sender });
  assert.ok(!m.html.includes('<img') && !m.html.includes('<script'));
  assert.ok(m.html.includes('&lt;img'));
});

test('unknown game throws', () => {
  assert.throws(() => renderGameLaunchEmail({ gameId: 'nope', webBase: 'https://w.test', sender }));
});

test('every game has a host note: Creator Pass for the Creator games, VIP for the others', () => {
  for (const [gameId, g] of Object.entries(GAME_EMAILS)) {
    assert.ok(g.hostNote && g.hostNote.length > 10, `${gameId} has no hostNote`);
    const m = renderGameLaunchEmail({ gameId, name: 'Alex', webBase: 'https://w.test', sender });
    assert.ok(m.text.includes(g.hostNote) && m.html.includes(g.hostNote.replace(/'/g, '&#39;')), `${gameId} note missing in the mail`);
  }
  const quiz = renderGameLaunchEmail({ gameId: 'quiz-show', name: 'Alex', webBase: 'https://w.test/', sender });
  assert.equal(quiz.url, 'https://w.test/games/quiz-show');
  assert.match(quiz.subject, /Quiz Show Studio is live/);
  assert.match(quiz.text, /Up to 30 players/);
  assert.match(quiz.text, /Creator Pass/);
  assert.ok(!/Watch\+/.test(quiz.text), 'the quiz mail must not claim VIP hosting');
  assert.equal(GAME_EMAILS['quiz-show'].bullets.length, 3);
  const murder = renderGameLaunchEmail({ gameId: 'murder-mystery', name: 'Alex', webBase: 'https://w.test/', sender });
  assert.equal(murder.url, 'https://w.test/games/murder-mystery');
  assert.match(murder.subject, /Murder Mystery Night is live/);
  assert.match(murder.text, /6-12 players/);
  assert.match(murder.text, /Creator Pass/);
  assert.ok(!/Watch\+/.test(murder.text), 'the murder mystery mail must not claim VIP hosting');
  assert.equal(GAME_EMAILS['murder-mystery'].bullets.length, 3);
  const arena = renderGameLaunchEmail({ gameId: 'tournament', name: 'Alex', webBase: 'https://w.test/', sender });
  assert.equal(arena.url, 'https://w.test/games/tournament');
  assert.match(arena.subject, /Tournament Arena is live/);
  assert.match(arena.text, /4-32 players/);
  assert.match(arena.text, /Creator Pass/);
  assert.ok(!/Watch\+/.test(arena.text), 'the tournament mail must not claim VIP hosting');
  assert.equal(GAME_EMAILS.tournament.title, 'Tournament Arena');
  assert.equal(GAME_EMAILS.tournament.bullets.length, 3);
  for (const id of ['imposter', 'emoji-charades', 'mafia']) assert.match(GAME_EMAILS[id].hostNote, /Watch\+ \(VIP Pass\)/);
});
