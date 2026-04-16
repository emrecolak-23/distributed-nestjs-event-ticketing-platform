import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { TemplateEngine } from '../templates/template.engine';
import { EmailAdapter } from '../channels/email.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationService, TemplateEngine, EmailAdapter],
  exports: [NotificationService],
})
export class NotificationModule {}
