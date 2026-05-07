import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Email Service — sends email notifications via a Bull queue + nodemailer.
 *
 * In production, this service would:
 *   1. Accept a notification payload
 *   2. Enqueue a Bull job for async delivery
 *   3. A worker picks up the job and sends via nodemailer
 *
 * For V2, we provide a simplified simulated implementation that logs
 * the email to the console instead of actually sending it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send an email notification.
   *
   * In production this would enqueue a Bull job. For now,
   * we simulate the send by logging.
   */
  async send(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ messageId: string }> {
    const { to, subject, body } = params;

    const smtpHost = this.configService.get<string>('email.smtpHost');
    const smtpPort = this.configService.get<number>('email.smtpPort');

    if (!smtpHost || !smtpPort) {
      this.logger.warn(
        'SMTP not configured. Using simulated email delivery.',
      );
      return this.simulateSend(params);
    }

    // In production, enqueue a Bull job here:
    // await this.bullQueue.add('email:send', params);
    this.logger.log(
      `[EMAIL QUEUED] To: ${to}, Subject: "${subject}" (via Bull queue)`,
    );

    throw new Error(
      'Email sending requires Bull queue + nodemailer infrastructure. ' +
      'Configure SMTP or use simulated mode for development.',
    );
  }

  private async simulateSend(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ messageId: string }> {
    const messageId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    this.logger.log(
      `\n📧 SIMULATED EMAIL\n   To: ${params.to}\n   Subject: ${params.subject}\n   Body:\n${params.body.substring(0, 500)}\n`,
    );

    // In production, this would print via console.log or a real email transport
    console.log(`\n[EMAIL] To: ${params.to}`);
    console.log(`[EMAIL] Subject: ${params.subject}`);
    console.log(`[EMAIL] MessageID: ${messageId}`);
    console.log(`[EMAIL] ---`);
    console.log(params.html || params.body);
    console.log(`[EMAIL] ---\n`);

    return { messageId };
  }
}
