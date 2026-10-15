# Security notes

## Billing (Watch+)

Tiers are decided only on the server from the stored subscription; clients cannot set them. Card, UPI and bank details are entered on Razorpay/Stripe pages and never reach this server. Payment webhooks are public but HMAC-verified on the raw body, replay-protected by event id and idempotent. Refund events are written to an append-only `billing_audit` collection and never revoke access automatically. `billing_payments` keeps only provider event id, user id, amount, currency and date; account deletion removes it. Mock billing is refused at boot in production, and `live` refuses to boot without a fully configured provider. A pilot allow-list (`BILLING_ALLOWLIST`) can restrict who may start a checkout. Provider adapters are unit tested with a fake `fetch` (never a real provider). Details and the going-live checklist: `BILLING.md`. Tests: SEC-80..SEC-96 and `apps/server/src/__tests__/billing.test.ts`.
