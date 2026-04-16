import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeGateway } from './gateways/stripe.gateway';
import { IyzicoGateway } from './gateways/iyzico.gateway';
import { KafkaClientModule } from '@app/kafka';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { RedisModule } from '@app/redis';
import { RefundService } from './refund.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    KafkaClientModule.register('PAYMENT_KAFKA'),
    RedisModule.register(),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentGatewayFactory,
    StripeGateway,
    IyzicoGateway,
    RefundService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
