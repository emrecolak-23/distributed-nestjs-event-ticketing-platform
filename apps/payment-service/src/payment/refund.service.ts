import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Refund } from './entities/refund.entity';
import { RefundStatus } from './enums';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './enums';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';

@Injectable()
export class RefundService implements OnModuleInit {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly paymentGatewayFactory: PaymentGatewayFactory,
    @Inject('PAYMENT_KAFKA') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async refundByBooking(
    bookingId: string,
    idempotencyKey: string,
    reason?: string,
  ): Promise<Refund> {
    const payment = await this.paymentRepo.findOne({
      where: { bookingId, status: PaymentStatus.SUCCEEDED },
    });

    if (!payment) {
      throw new BadRequestException(
        `No succeeded payment found for booking ${bookingId}`,
      );
    }

    const existing = await this.refundRepo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.log(
        `Duplicate refund key ${idempotencyKey} for payment ${payment.id}`,
      );
      return existing;
    }

    const refund = this.refundRepo.create({
      paymentId: payment.id,
      idempotencyKey,
      amount: payment.amount,
      reason,
      status: RefundStatus.PENDING,
    });

    const savedRefund = await this.refundRepo.save(refund);

    try {
      const gateway = this.paymentGatewayFactory.getByProvider(
        payment.provider,
      );

      if (!gateway) {
        throw new BadRequestException(
          `Unsupported payment provider: ${payment.provider}`,
        );
      }

      const refundResult = await gateway.refund(
        payment.providerTxId ?? '',
        payment.amount,
      );

      if (refundResult.success) {
        savedRefund.status = RefundStatus.PROCESSED;
        savedRefund.providerRefundId = refundResult.providerTxId ?? null;
        await this.refundRepo.save(savedRefund);

        payment.status = PaymentStatus.REFUNDED;
        await this.paymentRepo.save(payment);

        this.kafkaClient.emit('payment.refunded', {
          key: savedRefund.id,
          value: {
            refundId: savedRefund.id,
            paymentId: payment.id,
            bookingId: payment.bookingId,
            amount: payment.amount,
            currency: payment.currency,
            providerRefundId: savedRefund.providerRefundId,
          },
        });

        this.logger.log(
          `Refund ${savedRefund.id} processed for booking ${bookingId}`,
        );
      } else {
        savedRefund.status = RefundStatus.FAILED;
        savedRefund.failureReason = refundResult.failureReason ?? null;
        await this.refundRepo.save(savedRefund);

        this.logger.error(
          `Refund failed for booking ${bookingId}: ${refundResult.failureReason}`,
        );
      }

      return savedRefund;
    } catch (error) {
      savedRefund.status = RefundStatus.FAILED;
      savedRefund.failureReason = error.message ?? null;
      await this.refundRepo.save(savedRefund);

      this.logger.error(
        `Refund failed for booking ${bookingId}: ${error.message}`,
      );

      throw error;
    }
  }
}
