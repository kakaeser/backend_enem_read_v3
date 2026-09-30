import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';
import type { SendMailOptions } from './mail.types.js';

@Injectable()
export abstract class MailService {
  abstract send(options: SendMailOptions): Promise<void>;
}

@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger(ResendMailService.name);
  private readonly resend: Resend | undefined;

  constructor() {
    super();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async send(options: SendMailOptions): Promise<void> {
    if (!this.resend) {
      throw new InternalServerErrorException('RESEND_API_KEY não configurado');
    }
    const from = process.env.EMAIL_FROM?.trim();
    if (!from) {
      throw new InternalServerErrorException('EMAIL_FROM não configurado');
    }

    const attachments = options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));

    const { error } = await this.resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments,
    });

    if (error) {
      this.logger.error(`Resend send failed: ${error.message}`, error.name);
      throw new ServiceUnavailableException('Falha ao enviar e-mail');
    }
  }
}

@Injectable()
export class NoopMailService extends MailService {
  private readonly logger = new Logger(NoopMailService.name);

  constructor() {
    super();
  }

  async send(options: SendMailOptions): Promise<void> {
    const attachmentCount = options.attachments?.length ?? 0;
    const attachmentBytes =
      options.attachments?.reduce((sum, a) => sum + a.content.length, 0) ?? 0;
    this.logger.log(
      `[mail noop] to=${options.to} subject=${options.subject} attachments=${attachmentCount} bytes=${attachmentBytes}`,
    );
  }
}
