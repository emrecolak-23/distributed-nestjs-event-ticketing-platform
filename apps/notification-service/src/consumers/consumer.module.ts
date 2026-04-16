import { Module } from '@nestjs/common';
import { BookingConsumer } from './booking.consumer';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [BookingConsumer],
})
export class ConsumerModule {}
