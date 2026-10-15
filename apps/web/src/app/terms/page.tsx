import type { Metadata } from 'next';
import { LegalLayout, LegalValue, Section, List } from '../../components/legal/LegalLayout';
import { LEGAL } from '../../lib/legal';

export const metadata: Metadata = { title: 'Terms of Service | Watch' };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>Effective date: <LegalValue value={LEGAL.effectiveDate} />. These terms are between you and <LegalValue value={LEGAL.companyName} /> ("we", "us") and cover your use of {LEGAL.productName}, an app for watching together with friends in synced rooms, chatting, planning watch parties and playing games.</p>

      <Section title="1. Who can use Watch">
        <p>You must be at least 13 years old (or the minimum age in your country to use online services). If you are under the age of majority you need a parent or guardian to agree to these terms for you. You are responsible for your account and for keeping your password safe.</p>
      </Section>

      <Section title="2. What Watch is, and what it is not">
        <p>Watch keeps playback in sync between people. It does not host, sell or provide films, shows or other content. You are responsible for having the right to watch whatever you play in a room, through your own subscriptions or sources.</p>
      </Section>

      <Section title="3. Your content and conduct">
        <p>You own what you write and share (chat messages, plans, profile details). You give us the limited permission needed to store it and show it to the people you chose. Do not use Watch to:</p>
        <List items={[
          'harass, threaten or impersonate anyone, or share illegal content;',
          'share content you do not have the right to share;',
          'attack, overload or try to break into the service or other accounts;',
          'send spam, or use bots or scrapers without our permission.'
        ]} />
        <p>We may remove content or suspend accounts that break these rules.</p>
      </Section>

      <Section title="4. Plans: Watch Free and Watch+">
        <p>Watch Free costs nothing. Watch+ is an optional paid subscription. What it includes is shown on the pricing page; features marked "Soon" are not part of what you are buying today. Prices are shown before you pay. For customers in India prices include GST; elsewhere local taxes may be added at checkout.</p>
        <List items={[
          'Subscriptions renew automatically each month or year until you cancel.',
          'You can cancel at any time from your profile. You keep Watch+ until the end of the period you already paid for and are not charged again.',
          'Payments are processed by Razorpay (India) or Stripe (elsewhere). We never see or store your card, UPI or bank details.',
          'If a renewal payment fails we may give you a short grace period and then return your account to Watch Free. Your existing plans and data are kept.',
          'We may change prices or features with advance notice; a change applies from your next renewal and you can cancel before then.'
        ]} />
        <p>Refunds are covered in our <a className="underline text-[#ee1d49]" href="/refunds">Refund and Cancellation Policy</a>.</p>
      </Section>

      <Section title="5. Our service and changes">
        <p>We work to keep Watch available, but it is provided "as is" and may have interruptions, bugs or changes. We may add, change or remove features, with notice where a paid feature is materially affected.</p>
      </Section>

      <Section title="6. Ending your account">
        <p>You can stop using Watch at any time and ask us to delete your account (see the <a className="underline text-[#ee1d49]" href="/privacy">Privacy Policy</a>). We may suspend or end accounts that break these terms. Cancel any paid subscription first so you are not charged again.</p>
      </Section>

      <Section title="7. Liability">
        <p>To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under consumer protection law that cannot be limited.</p>
      </Section>

      <Section title="8. Governing law and disputes">
        <p>These terms are governed by the laws of India. Courts in <LegalValue value={LEGAL.governingCity} /> have jurisdiction, without affecting any right you have to bring a consumer complaint in your own place of residence. Please write to us first at <LegalValue value={LEGAL.contactEmail} /> so we can try to fix the problem.</p>
      </Section>

      <Section title="9. Contact">
        <p><LegalValue value={LEGAL.companyName} />, <LegalValue value={LEGAL.address} />. Email: <LegalValue value={LEGAL.contactEmail} />.</p>
      </Section>
    </LegalLayout>
  );
}
