import { Injectable, Logger } from '@nestjs/common';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';

@Injectable()
export class ConsoleMailAdapter implements MailPort {
  private readonly logger = new Logger(ConsoleMailAdapter.name);

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(
      `[MAIL] to=${input.to.email} subject="${input.subject}" tags=${(input.tags ?? []).join(',')}`,
    );
    this.logger.debug(input.text);
  }
}
