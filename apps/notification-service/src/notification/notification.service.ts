import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationChannelAdapter } from '../channels/interfaces';
import { TemplateEngine } from '../templates/template.engine';
import { NotificationStatus } from './enums';
import { EmailAdapter } from '../channels/email.adapter';
import { SendNotificationInput } from './interfaces';
import { NotificationChannel } from '../channels/enums';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private readonly templateEngine: TemplateEngine,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  async send(input: SendNotificationInput): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: input.userId,
      channel: input.channel,
      type: input.type,
      templateId: input.templateId,
      recipient: input.recipient,
      payload: input.payload,
      status: NotificationStatus.QUEUED,
    });

    const saved = await this.notificationRepo.save(notification);

    try {
      const rendered = this.templateEngine.render(
        input.templateId,
        input.payload,
      );

      let result;

      if (input.channel === NotificationChannel.EMAIL) {
        result = await this.emailAdapter.send({
          to: input.recipient,
          subjects: rendered.subject,
          body: rendered.body,
          html: rendered.html,
        });
      } else {
        throw new BadRequestException(`Unsupported channel: ${input.channel}`);
      }

      if (result.success) {
        saved.status = NotificationStatus.SENT;
        saved.sentAt = new Date();
      } else {
        saved.status = NotificationStatus.FAILED;
        saved.failureReason = result.error;
      }

      return this.notificationRepo.save(saved);
    } catch (error) {
      this.logger.error(`Notification send failed: ${error.message}`);
      saved.status = NotificationStatus.FAILED;
      saved.failureReason = error.message;
      return this.notificationRepo.save(saved);
    }
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: {
        userId,
      },
    });
  }
}
