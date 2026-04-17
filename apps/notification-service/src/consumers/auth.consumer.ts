import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';
import { NotificationChannel } from '../channels/enums';

@Controller()
export class AuthConsumer {
  private readonly logger = new Logger(AuthConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('auth.email_verification')
  async handleEmailVerification(@Payload() payload: any) {
    const data = payload.value;

    this.logger.log(`Email verification email sent to ${data.email}`);

    await this.notificationService.send({
      userId: data.userId,
      channel: NotificationChannel.EMAIL,
      type: 'email_verification',
      templateId: 'email_verification',
      recipient: data.email,
      payload: {
        fullName: data.fullName,
        verificationUrl: data.verificationUrl,
      },
    });
  }

  @EventPattern('auth.password_reset')
  async handlePasswordReset(@Payload() payload: any) {
    const data = payload.value;

    this.logger.log(`Password reset email sent to ${data.email}`);

    await this.notificationService.send({
      userId: data.userId,
      channel: NotificationChannel.EMAIL,
      type: 'password_reset',
      templateId: 'password_reset',
      recipient: data.email,
      payload: {
        fullName: data.fullName,
        resetUrl: data.resetUrl,
      },
    });
  }
}
