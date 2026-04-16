import { Module } from '@nestjs/common';
import { PaymentGrpcController } from '../payment/payment.grpc-controller';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [PaymentGrpcController],
})
export class GrpcServerModule {}
