import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, guessCountry, yearlySavingPercent } from '../billingApi';

test('formatMoney shows INR without decimals when whole', () => {
  assert.equal(formatMoney(19900, 'INR').replace(/\s/g, ''), '₹199');
  assert.match(formatMoney(19950, 'INR'), /199\.50/);
});

test('formatMoney formats USD, EUR, GBP minor units', () => {
  assert.equal(formatMoney(399, 'USD'), '$3.99');
  assert.match(formatMoney(399, 'EUR'), /3\.99/);
  assert.equal(formatMoney(349, 'GBP'), '£3.49');
});

test('guessCountry uses timezone for India and language region otherwise', () => {
  assert.equal(guessCountry({ timeZone: 'Asia/Kolkata', language: 'en-US' }), 'IN');
  assert.equal(guessCountry({ timeZone: 'Asia/Calcutta' }), 'IN');
  assert.equal(guessCountry({ timeZone: 'Europe/London', language: 'en-GB' }), 'GB');
  assert.equal(guessCountry({ timeZone: 'America/New_York', language: 'en' }), undefined);
});

test('yearlySavingPercent', () => {
  assert.equal(yearlySavingPercent({ monthly: 19900, yearly: 199000 }), 17);
  assert.equal(yearlySavingPercent({ monthly: 100, yearly: 1200 }), 0);
  assert.equal(yearlySavingPercent({ monthly: 0, yearly: 0 }), 0);
});
