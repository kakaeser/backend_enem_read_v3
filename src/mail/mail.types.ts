export type MailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
};

export type SentMailAttachmentMeta = {
  filename: string;
  size: number;
};

export type SentMail = {
  to: string;
  subject: string;
  html: string;
  attachments?: SentMailAttachmentMeta[];
};
