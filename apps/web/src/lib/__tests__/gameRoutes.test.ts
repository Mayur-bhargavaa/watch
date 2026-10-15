import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalGameId, gameIdFromRoomCode, gameRoutePath, gameTitleFor } from '../gameRoutes';

test('aliases resolve exactly', () => {
  assert.equal(canonicalGameId('Connect-Four'), 'four-in-a-row');
  assert.equal(canonicalGameId('pictionary'), 'doodle-duel');
  assert.equal(canonicalGameId('ludoish'), null);
});

test('routes', () => {
  assert.equal(gameRoutePath('chess', 'CHESS-AB12'), '/games/chess?room=CHESS-AB12');
  assert.equal(gameRoutePath(undefined, 'BINGO-XY'), '/games/bingo?room=BINGO-XY');
  assert.equal(gameRoutePath(undefined, 'AB12'), '/games/ludo?room=AB12');
  assert.equal(gameRoutePath('mystery-x', 'AB12'), '/games');
  assert.equal(gameTitleFor('mystery-x'), 'Game');
  assert.equal(gameTitleFor('tictactoe'), 'Tic-Tac-Toe');
});

test('Mafia Night: id, aliases, room code prefix and the /games/mafia route', () => {
  assert.equal(canonicalGameId('mafia-night'), 'mafia-night');
  assert.equal(canonicalGameId('Mafia'), 'mafia-night');
  assert.equal(gameIdFromRoomCode('MAFIA-AB12'), 'mafia-night');
  assert.equal(gameRoutePath('mafia-night', 'MAFIA-AB12'), '/games/mafia?room=MAFIA-AB12');
  assert.equal(gameRoutePath(undefined, 'MAFIA-AB12'), '/games/mafia?room=MAFIA-AB12');
  assert.equal(gameTitleFor('mafia'), 'Mafia Night');
});

test('Quiz Show Studio: id, aliases, room code prefix and the /games/quiz-show route', () => {
  assert.equal(canonicalGameId('quiz-show'), 'quiz-show');
  assert.equal(canonicalGameId('Quiz'), 'quiz-show');
  assert.equal(canonicalGameId('quizshow'), 'quiz-show');
  assert.equal(gameIdFromRoomCode('QUIZ-AB12'), 'quiz-show');
  assert.equal(gameRoutePath('quiz-show', 'QUIZ-AB12'), '/games/quiz-show?room=QUIZ-AB12');
  assert.equal(gameRoutePath(undefined, 'QUIZ-AB12'), '/games/quiz-show?room=QUIZ-AB12');
  assert.equal(gameTitleFor('quiz'), 'Quiz Show Studio');
});

test('Murder Mystery Night: id, aliases, room code prefix and the /games/murder-mystery route', () => {
  assert.equal(canonicalGameId('murder-mystery'), 'murder-mystery');
  assert.equal(canonicalGameId('Murder'), 'murder-mystery');
  assert.equal(canonicalGameId('mystery'), 'murder-mystery');
  assert.equal(gameIdFromRoomCode('MURDER-AB12'), 'murder-mystery');
  assert.equal(gameRoutePath('murder-mystery', 'MURDER-AB12'), '/games/murder-mystery?room=MURDER-AB12');
  assert.equal(gameTitleFor('murder'), 'Murder Mystery Night');
});

test('Tournament Arena: id, aliases, room code prefix and the /games/tournament route', () => {
  assert.equal(canonicalGameId('tournament'), 'tournament');
  assert.equal(canonicalGameId('Tournament-Arena'), 'tournament');
  assert.equal(canonicalGameId('arena'), 'tournament');
  assert.equal(gameIdFromRoomCode('ARENA-AB12'), 'tournament');
  assert.equal(gameRoutePath('tournament', 'ARENA-AB12'), '/games/tournament?room=ARENA-AB12');
  assert.equal(gameRoutePath(undefined, 'ARENA-AB12'), '/games/tournament?room=ARENA-AB12');
  assert.equal(gameRoutePath('tournament'), '/games/tournament');
  assert.equal(gameTitleFor('arena'), 'Tournament Arena');
  // the match rooms a tournament creates open on the pages of their own games
  assert.equal(gameRoutePath('tic-tac-toe', 'TIC-AB12CD34'), '/games/tic-tac-toe?room=TIC-AB12CD34');
  assert.equal(gameRoutePath('four-in-a-row', 'FOUR-AB12CD34'), '/games/four-in-a-row?room=FOUR-AB12CD34');
  assert.equal(gameRoutePath('chess', 'CHESS-AB12CD34'), '/games/chess?room=CHESS-AB12CD34');
});
