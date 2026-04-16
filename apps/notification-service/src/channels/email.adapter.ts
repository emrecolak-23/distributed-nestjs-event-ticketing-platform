import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  NotificationChannelAdapter,
  ChannelMessage,
  ChannelResult,
} from './interfaces';

@Injectable()
export class EmailAdapter implements NotificationChannelAdapter {
  readonly name = 'email';
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ?? 'noreply@example.com';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 1025),
      secure: false,
      auth: this.configService.get('SMTP_USER')
        ? {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
  }

  async send(message: ChannelMessage): Promise<ChannelResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subjects ?? '',
        text: message.body,
        html: message.html,
      });

      this.logger.log(`Email sent to ${message.to}: ${info.messageId}`);

      return {
        success: true,
        providerId: info.messageId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${message.to}: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
