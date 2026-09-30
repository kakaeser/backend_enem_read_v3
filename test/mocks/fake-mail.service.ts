import { Injectable } from '@nestjs/common';
import { MailService } from '../../src/mail/mail.service.js';
import type { SendMailOptions, SentMail } from '../../src/mail/mail.types.js';

@Injectable()
export class FakeMailService extends MailService {
  readonly sent: SentMail[] = [];

  clear(): void {
    this.sent.length = 0;
  }

  async send(options: SendMailOptions): Promise<void> {
    this.sent.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        size: a.content.length,
      })),
    });
  }
}
