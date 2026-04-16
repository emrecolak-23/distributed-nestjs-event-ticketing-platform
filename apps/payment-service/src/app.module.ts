import { Module } from '@nestjs/common';

import { PaymentModule } from './payment/payment.module';
import { PostgresDatabaseModule } from '@app/database';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/payment-service/.env',
    }),
    PostgresDatabaseModule,
    PaymentModule,
  ],
})
export class PaymentServiceModule {}
