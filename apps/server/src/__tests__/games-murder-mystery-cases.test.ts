import './_noRealDb.js'; // never reach a real database from tests
import test from 'node:test';
import assert from 'node:assert/strict';
import type { MurderCaseDef } from '@synccinema/common';
import { MURDER_CASES, getMurderCase, murderCaseSummaries } from '../games/murderMysteryCases.js';

const EMOJI = /\p{Extended_Pictographic}/u;
const FORBIDDEN_PUBLIC = /murderer|killer|guilty/i;

/** Every string of a case (for the length / emoji checks). */
function allTexts(c: MurderCaseDef): string[] {
  const out: string[] = [c.title, c.tagline, c.blurb, c.victim.name, c.victim.bio, c.victim.causeOfDeath];
  for (const x of c.characters) out.push(x.name, x.bio, x.relationship, x.secretMotive, x.alibi, x.alibiTruth, x.secret);
  out.push(c.solution.motive, c.solution.method, c.solution.summary, ...c.timeline);
  for (const r of c.rounds) {
    out.push(r.title);
    for (const p of r.publicClues) out.push(p.text);
    for (const p of r.privateClues) out.push(p.text);
  }
  return out;
}

const tokens = (s: string): string[] => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length >= 3);

test('the catalogue has exactly three cases with unique ids and working lookups', () => {
  assert.equal(MURDER_CASES.length, 3);
  assert.equal(new Set(MURDER_CASES.map((c) => c.id)).size, 3);
  for (const c of MURDER_CASES) assert.equal(getMurderCase(c.id), c);
  assert.equal(getMurderCase('nope'), undefined);
  const sums = murderCaseSummaries();
  assert.equal(sums.length, 3);
  assert.deepEqual(sums.map((s) => s.id), MURDER_CASES.map((c) => c.id));
  for (const s of sums) assert.ok(s.title && s.blurb && s.tagline && s.victimName);
});

for (const c of MURDER_CASES) {
  test(`${c.id}: structure (12 characters, valid required set and murderer, 4 rounds)`, () => {
    assert.equal(c.characters.length, 12);
    const ids = c.characters.map((x) => x.id);
    assert.equal(new Set(ids).size, 12, 'character ids are unique');
    assert.equal(new Set(c.characters.map((x) => x.name)).size, 12, 'character names are unique');
    for (const id of ids) assert.match(id, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(ids.includes(c.solution.murdererId), 'murderer is a character');
    assert.ok(c.required.length <= 6 && c.required.length >= 2);
    assert.equal(new Set(c.required).size, c.required.length);
    for (const id of c.required) assert.ok(ids.includes(id), `required ${id} exists`);
    assert.ok(c.required.includes(c.solution.murdererId), 'required includes the murderer');
    assert.equal(c.rounds.length, 4);
    assert.ok(c.timeline.length >= 6 && c.timeline.length <= 10);
  });

  test(`${c.id}: clues (counts, owners, ids)`, () => {
    const ids = new Set(c.characters.map((x) => x.id));
    const clueIds: string[] = [];
    const owners = new Set<string>();
    for (const r of c.rounds) {
      assert.ok(r.publicClues.length >= 1 && r.publicClues.length <= 2, 'one or two public clues per round');
      assert.ok(r.privateClues.length >= 2 && r.privateClues.length <= 4, 'two to four private clues per round');
      for (const p of r.publicClues) clueIds.push(p.id);
      for (const p of r.privateClues) {
        clueIds.push(p.id);
        assert.ok(ids.has(p.ownerId), `private clue ${p.id} owner exists`);
        owners.add(p.ownerId);
      }
    }
    assert.equal(new Set(clueIds).size, clueIds.length, 'clue ids are unique');
    assert.ok(owners.size >= 5, 'at least five distinct private clue owners');
    for (const id of c.required) {
      if (id !== c.solution.murdererId) assert.ok(owners.has(id), `required ${id} owns a private clue (solvability)`);
    }
    // the cast of a minimal game (the required set) holds every clue the solution leans on
    const requiredOwners = new Set(c.rounds.flatMap((r) => r.privateClues).filter((p) => c.required.includes(p.ownerId)).map((p) => p.ownerId));
    for (const id of c.required) if (id !== c.solution.murdererId) assert.ok(requiredOwners.has(id));
  });

  test(`${c.id}: every text is a sane non-empty string without emoji`, () => {
    for (const t of allTexts(c)) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0 && t.length <= 400, `bad length: ${t.slice(0, 40)}`);
      assert.ok(!EMOJI.test(t), `emoji in: ${t.slice(0, 40)}`);
    }
  });

  test(`${c.id}: no spoilers in the public clues of rounds 1-3`, () => {
    const murderer = c.characters.find((x) => x.id === c.solution.murdererId)!;
    const nameTokens = new Set(tokens(murderer.name));
    for (const r of c.rounds.slice(0, 3)) {
      for (const p of r.publicClues) {
        const words = tokens(p.text);
        for (const w of words) assert.ok(!nameTokens.has(w), `public clue ${p.id} contains the murderer's name token "${w}"`);
        assert.ok(!FORBIDDEN_PUBLIC.test(p.text), `public clue ${p.id} uses a forbidden word`);
        assert.ok(!p.text.includes(murderer.secretMotive), `public clue ${p.id} contains the murderer's motive`);
        assert.ok(!p.text.includes(c.solution.motive), `public clue ${p.id} contains the solution motive`);
      }
    }
    // public text of the whole case never uses the character ids either
    for (const r of c.rounds) for (const p of r.publicClues) assert.ok(!p.text.includes(murderer.id));
  });

  test(`${c.id}: the murderer's alibi is flagged false and the innocents' are confirmed`, () => {
    for (const x of c.characters) {
      const murderer = x.id === c.solution.murdererId;
      assert.equal(/^false\b/i.test(x.alibiTruth), murderer, `${x.id}: alibiTruth ${murderer ? 'must expose the lie' : 'must confirm the alibi'}`);
    }
  });
}
