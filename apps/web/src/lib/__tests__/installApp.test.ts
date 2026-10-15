import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInstallState } from '../installApp';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36';
const MAC = IPAD_DESKTOP_UA;

test('detects what to ask the user to do on each device', () => {
  const base = { standalone: false, hasInstallPrompt: false };
  assert.equal(detectInstallState({ ...base, userAgent: IPHONE_SAFARI }), 'ios-safari');
  assert.equal(detectInstallState({ ...base, userAgent: IPHONE_CHROME }), 'ios-other-browser');
  assert.equal(detectInstallState({ ...base, userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 }), 'ios-safari');
  assert.equal(detectInstallState({ ...base, userAgent: MAC, maxTouchPoints: 0 }), 'none');
  assert.equal(detectInstallState({ ...base, userAgent: ANDROID }), 'none');
  assert.equal(detectInstallState({ ...base, userAgent: ANDROID, hasInstallPrompt: true }), 'can-prompt');
  assert.equal(detectInstallState({ standalone: true, hasInstallPrompt: true, userAgent: IPHONE_SAFARI }), 'installed');
});
