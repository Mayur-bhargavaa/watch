import nodemailer, { type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Transactional mail (password reset links).
 *  - SMTP_URL set            -> real delivery via SMTP (MAIL_FROM = sender address)
 *  - MAIL_TRANSPORT=memory   -> messages are kept in `outbox` (used by the test-suite)
 *  - neither                 -> the message is printed to the server log (local development only)
 */
class Mailer {
  readonly outbox: Mail[] = [];
  private transport: Transporter | null = null;

  /** True when real delivery (or the in-memory test transport) is configured. */
  isConfigured(): boolean {
    return process.env.MAIL_TRANSPORT === 'memory' || Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);
  }

  private getTransport(): Transporter {
    if (this.transport) return this.transport;
    if (process.env.SMTP_URL) {
      this.transport = nodemailer.createTransport(process.env.SMTP_URL);
    } else {
      const port = Number(process.env.SMTP_PORT) || 587;
      this.transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : port === 465,
        // Credentials are separate variables so characters like "@" never need URL-encoding
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
      });
    }
    return this.transport;
  }

  /** Verifies the SMTP login at startup so a typo in credentials is found at deploy time, not by a locked-out user. */
  async verify(): Promise<void> {
    if (process.env.MAIL_TRANSPORT === 'memory' || !this.isConfigured()) return;
    await this.getTransport().verify();
  }

  /**
   * Every send attempt prints one coloured line in the server log:
   *   green = accepted by the mail server, red = failed.
   * Outside production the one-time link(s) in the body are printed too (temporary debugging aid for when the
   * email does not arrive). In production links are credentials, so only the status line is written.
   */
  async send(mail: Mail): Promise<void> {
    const GREEN = '\x1b[32m';
    const RED = '\x1b[31m';
    const RESET = '\x1b[0m';
    try {
      const info = await this.deliver(mail);
      console.log(`${GREEN}✅ [mail] SENT   to=${mail.to} | "${mail.subject}"${info ? ` | ${info}` : ''}${RESET}`);
      if (process.env.NODE_ENV !== 'production') {
        for (const link of mail.text.match(/https?:\/\/\S+/g) || []) {
          console.log(`${GREEN}🔗 [mail] link in this email (dev only): ${link}${RESET}`);
        }
      }
    } catch (err: any) {
      console.log(`${RED}❌ [mail] FAILED to=${mail.to} | "${mail.subject}" | ${err?.message || err}${RESET}`);
      throw err;
    }
  }

  private async deliver(mail: Mail): Promise<string> {
    if (process.env.MAIL_TRANSPORT === 'memory') {
      this.outbox.push(mail);
      return 'memory transport';
    }
    if (this.isConfigured()) {
      const info = await this.getTransport().sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || 'Watch <no-reply@localhost>',
        to: mail.to,
        // Replies go to a real, monitored mailbox (the sending address is send-only)
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        subject: mail.subject,
        text: mail.text
      });
      return String(info.response || '').slice(0, 80);
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mail is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS or SMTP_URL)');
    }
    // Development only, no SMTP configured: nothing is delivered (the caller logs the green line + link above)
    return 'no SMTP configured: not delivered, link printed below';
  }
}

export const mailer = new Mailer();
