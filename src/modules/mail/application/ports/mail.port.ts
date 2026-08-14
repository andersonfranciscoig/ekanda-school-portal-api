export type MailAddress = {
  email: string;
  name?: string;
};

export type SendMailInput = {
  to: MailAddress;
  subject: string;
  html: string;
  text: string;
  replyTo?: MailAddress;
  tags?: string[];
};

export const MAIL_PORT = Symbol('MAIL_PORT');

export interface MailPort {
  send(input: SendMailInput): Promise<void>;
}
