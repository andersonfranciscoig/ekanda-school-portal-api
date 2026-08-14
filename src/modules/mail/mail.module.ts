import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_PORT } from './application/ports/mail.port';
import { MailService } from './application/mail.service';
import { EmailChallengeService } from './application/email-challenge.service';
import { ConsoleMailAdapter } from './infrastructure/adapters/console-mail.adapter';
import { BrevoMailAdapter } from './infrastructure/adapters/brevo-mail.adapter';
import { MailRecipientsService } from './application/mail-recipients.service';
import { SubscriptionExpiryCron } from './infrastructure/cron/subscription-expiry.cron';

@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    MailRecipientsService,
    EmailChallengeService,
    ConsoleMailAdapter,
    BrevoMailAdapter,
    SubscriptionExpiryCron,
    {
      provide: MAIL_PORT,
      inject: [ConfigService, ConsoleMailAdapter, BrevoMailAdapter],
      useFactory: (
        config: ConfigService,
        console: ConsoleMailAdapter,
        brevo: BrevoMailAdapter,
      ) => {
        const provider = (config.get<string>('EMAIL_PROVIDER') ?? 'brevo')
          .trim()
          .toLowerCase();
        if (provider === 'brevo') {
          const key = config.get<string>('EMAIL_API_KEY')?.trim();
          if (!key) {
            Logger.warn(
              'EMAIL_API_KEY em falta — crie em Brevo → SMTP & API → API keys e adicione ao .env',
              'MailModule',
            );
          }
          return brevo;
        }
        if (provider !== 'console') {
          Logger.warn(
            `EMAIL_PROVIDER="${provider}" desconhecido — a usar console`,
            'MailModule',
          );
        }
        return console;
      },
    },
  ],
  exports: [MailService, MailRecipientsService, EmailChallengeService, MAIL_PORT],
})
export class MailModule {}
