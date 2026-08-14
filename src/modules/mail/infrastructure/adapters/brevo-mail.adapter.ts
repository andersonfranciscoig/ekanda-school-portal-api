import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';

@Injectable()
export class BrevoMailAdapter implements MailPort {
  private readonly logger = new Logger(BrevoMailAdapter.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyToEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromEmail = config.get<string>('EMAIL_FROM') ?? 'noreply@ekanda.ao';
    this.fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'Ekanda';
    this.replyToEmail =
      config.get<string>('EMAIL_REPLY_TO') ?? 'ekandacode@gmail.com';
  }

  private resolveApiKey(): string {
    const key = this.config.get<string>('EMAIL_API_KEY')?.trim();
    if (!key) {
      throw new Error(
        'EMAIL_API_KEY em falta — crie uma chave em Brevo → SMTP & API → API keys',
      );
    }
    return key;
  }

  async send(input: SendMailInput): Promise<void> {
    const apiKey = this.resolveApiKey();
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: input.to.email, name: input.to.name ?? input.to.email }],
        replyTo: {
          email: input.replyTo?.email ?? this.replyToEmail,
          name: input.replyTo?.name ?? 'Ekanda',
        },
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        tags: input.tags,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Brevo error ${res.status}: ${body}`);
      throw new Error(`Brevo mail failed: ${res.status}`);
    }
  }
}
