import { Module } from '@nestjs/common';
import { MailService, NoopMailService, ResendMailService } from './mail.service.js';

@Module({
  providers: [
    ResendMailService,
    NoopMailService,
    {
      provide: MailService,
      useFactory: (resend: ResendMailService, noop: NoopMailService) =>
        process.env.RESEND_API_KEY?.trim() ? resend : noop,
      inject: [ResendMailService, NoopMailService],
    },
  ],
  exports: [MailService],
})
export class MailModule {}
