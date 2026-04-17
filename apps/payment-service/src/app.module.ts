import { Module } from '@nestjs/common';

import { PaymentModule } from './payment/payment.module';
import { PostgresDatabaseModule } from '@app/database';
import { ConfigModule } from '@nestjs/config';
import { GrpcServerModule } from './grpc/grpc-server.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/payment-service/.env', '.env.shared'],
    }),
    PostgresDatabaseModule,
    PaymentModule,
    GrpcServerModule,
  ],
})
export class PaymentServiceModule {}
