import type { Metadata } from 'next';
import { LegalLayout, LegalValue, Section, List } from '../../components/legal/LegalLayout';
import { LEGAL } from '../../lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy | Watch' };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>Effective date: <LegalValue value={LEGAL.effectiveDate} />. This explains what <LegalValue value={LEGAL.companyName} /> ("we") collects when you use {LEGAL.productName}, why, and what you can do about it.</p>

      <Section title="1. What we collect">
        <List items={[
          'Account details: email address, display name, avatar and a password (stored only as a one-way hash).',
          'What you do in the app: rooms you create or join, chat messages, direct messages to friends, plans and RSVPs, game results, watch streaks and your friends list.',
          'Device and notification data: push notification tokens and basic technical data (browser type, IP address in server logs) used to deliver notifications and keep the service secure.',
          'Subscription status: whether you have Watch+, the billing period, the currency and identifiers from our payment provider, plus a record of each successful charge (date, amount, currency).'
        ]} />
        <p>We do not collect your card, UPI or bank details. Payments are entered on pages run by Razorpay or Stripe, who act as separate controllers for that payment data under their own privacy policies.</p>
      </Section>

      <Section title="2. Why we use it">
        <List items={[
          'to run the service: sign you in, sync rooms, deliver chat, plans and notifications;',
          'to provide and manage your subscription;',
          'to keep Watch safe: prevent abuse, fraud and attacks, and fix bugs;',
          'to contact you about your account (verification, password reset, receipts, important changes).'
        ]} />
        <p>We do not sell your personal data and we do not show third-party ads.</p>
      </Section>

      <Section title="3. What other people can see">
        <p>Friends can see your display name, avatar, badge (Standard, VIP or Creator Pass), your streak with them and whether you are online. People in a room or plan with you can see your name and avatar and the messages you post there. Direct messages are visible only to you and the recipient. Rooms and plans you make public or share an invite link for can be seen by anyone with that link.</p>
      </Section>

      <Section title="4. Who we share data with">
        <p>Only service providers that help us run Watch, under their own commitments: hosting and database providers, an email delivery provider, browser push services, and Razorpay or Stripe for payments. We may disclose data if the law requires it or to protect people from harm.</p>
      </Section>

      <Section title="5. Cookies and local storage">
        <p>We use a cookie or browser storage to keep you signed in and to remember settings such as your theme. These are needed for the app to work. We do not use advertising cookies.</p>
      </Section>

      <Section title="6. How long we keep it">
        <p>We keep your data while your account exists. When you delete your account we remove your profile, friends, messages, subscription and payment records from our database. Payment providers and tax law may require them or us to keep some transaction records for a period (for example invoices); those are kept only as long as required. Backups roll off over time.</p>
      </Section>

      <Section title="7. Your choices and rights">
        <p>You can edit your profile in the app, turn off notifications in your browser, and cancel your subscription at any time. You can ask us to give you a copy of your data (export), correct it, or delete your account and data by emailing <LegalValue value={LEGAL.contactEmail} /> from the address on your account. Depending on where you live you may have further rights, including to object to or restrict processing and to complain to your data protection authority. We reply within 30 days.</p>
      </Section>

      <Section title="8. Children">
        <p>Watch is for people aged 13 and over. We do not knowingly collect data from children under 13; if you think a child has an account, tell us and we will delete it.</p>
      </Section>

      <Section title="9. Security and where data is stored">
        <p>We use industry-standard protections (encryption in transit, hashed passwords, access controls), but no system is perfectly secure. Your data may be processed on servers outside your country; we use providers that protect it appropriately.</p>
      </Section>

      <Section title="10. Changes, contact and grievances">
        <p>We will update this page and the date above when this policy changes, and tell you about important changes. Questions or requests: <LegalValue value={LEGAL.contactEmail} />. Grievance officer (India): <LegalValue value={LEGAL.grievanceOfficerName} />, <LegalValue value={LEGAL.grievanceOfficerEmail} />. Address: <LegalValue value={LEGAL.address} />. This policy is governed by the laws of India.</p>
      </Section>
    </LegalLayout>
  );
}
