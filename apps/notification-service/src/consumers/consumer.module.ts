import { Module } from '@nestjs/common';
import { BookingConsumer } from './booking.consumer';
import { AuthConsumer } from './auth.consumer';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [BookingConsumer, AuthConsumer],
})
export class ConsumerModule {}
