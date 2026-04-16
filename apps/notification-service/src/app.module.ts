import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresDatabaseModule } from '@app/database';
import { NotificationModule } from './notification/notification.module';
import { ConsumerModule } from './consumers/consumer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/notification-service/.env',
    }),
    PostgresDatabaseModule,
    NotificationModule,
    ConsumerModule,
  ],
})
export class AppModule {}
