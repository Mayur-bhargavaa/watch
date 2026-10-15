import type { Metadata } from 'next';
import { LegalLayout, LegalValue, Section, List } from '../../components/legal/LegalLayout';
import { LEGAL } from '../../lib/legal';

export const metadata: Metadata = { title: 'Refund and Cancellation Policy | Watch' };

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund and Cancellation Policy">
      <p>Effective date: <LegalValue value={LEGAL.effectiveDate} />. This applies to the optional Watch+ subscription sold by <LegalValue value={LEGAL.companyName} />. Watch Free is free and has nothing to refund.</p>

      <Section title="Cancel any time">
        <List items={[
          'Cancel from your profile (Membership section) in one click. You do not need to contact us.',
          'After you cancel you keep Watch+ until the end of the period you already paid for, and you are not charged again.',
          'Razorpay subscriptions cannot be resumed after cancelling: subscribe again when you want to return. Stripe subscriptions can be resumed before the period ends.',
          'When the period ends you return to Watch Free. Your plans, friends and messages are kept.'
        ]} />
      </Section>

      <Section title="Refunds">
        <List items={[
          'We do not automatically refund part of a period when you cancel: the unused time stays available to you until it ends.',
          <>If you were charged by mistake, charged twice, or something stopped Watch+ from working for you, write to us within <LegalValue value={LEGAL.refundWindowDays} /> days of the charge and we will review it and refund where it is fair to do so.</>,
          'Refunds are decided case by case at our discretion, and are sent to the original payment method. Timing depends on your bank or card; it usually takes 5 to 10 business days.',
          'A refund does not cancel your subscription by itself. Cancel it too, or you will be charged at the next renewal.'
        ]} />
      </Section>

      <Section title="Failed or disputed payments">
        <p>If a renewal fails we may retry it and give a short grace period before returning you to Watch Free. If you see a charge you do not recognise, email us before disputing it with your bank so we can sort it out quickly.</p>
      </Section>

      <Section title="Your consumer rights">
        <p>Nothing in this policy limits your rights under the Consumer Protection Act, 2019 and the e-commerce rules in India, or the consumer laws of the country where you live, including any statutory right to cancel or to a remedy for a service that is not as described.</p>
      </Section>

      <Section title="Invoices">
        <p>Tax invoices and receipts are emailed by the payment provider (Razorpay or Stripe). Your recent payments are also listed in your profile under Membership.</p>
      </Section>

      <Section title="How to contact us">
        <p>Email <LegalValue value={LEGAL.contactEmail} /> with your account email, the date and amount of the charge. Grievance officer: <LegalValue value={LEGAL.grievanceOfficerName} /> (<LegalValue value={LEGAL.grievanceOfficerEmail} />). Address: <LegalValue value={LEGAL.address} />.</p>
      </Section>
    </LegalLayout>
  );
}
