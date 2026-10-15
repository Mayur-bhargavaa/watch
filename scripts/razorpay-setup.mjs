#!/usr/bin/env node
// Creates the two Watch+ subscription plans in YOUR Razorpay account and prints the env lines to paste.
// Run it yourself (it calls Razorpay): RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... node scripts/razorpay-setup.mjs
// Use test keys (rzp_test_...) first. Amounts come from packages/common TIER_PRICES (INR, paise).
import { TIER_PRICES } from '../packages/common/dist/membership.js';

const id = process.env.RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
if (!id || !secret) {
  console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your shell first.');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
const inr = TIER_PRICES.plus.INR;
const cr = TIER_PRICES.creator.INR;

async function createPlan(period, amount, name) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, interval: 1, item: { name, amount, currency: 'INR', description: 'Watch+ (VIP Pass)' } })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${JSON.stringify(body.error || body)}`);
  return body.id;
}

const monthly = await createPlan('monthly', inr.monthly, 'Watch+ monthly');
const yearly = await createPlan('yearly', inr.yearly, 'Watch+ yearly');
const crMonthly = await createPlan('monthly', cr.monthly, 'Communities & Creators monthly');
const crYearly = await createPlan('yearly', cr.yearly, 'Communities & Creators yearly');
console.log(`\nAdd to apps/server/.env:\nRAZORPAY_PLAN_PLUS_MONTHLY=${monthly}\nRAZORPAY_PLAN_PLUS_YEARLY=${yearly}\nRAZORPAY_PLAN_CREATOR_MONTHLY=${crMonthly}\nRAZORPAY_PLAN_CREATOR_YEARLY=${crYearly}\n`);
