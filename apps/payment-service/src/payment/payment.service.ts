import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './enums';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly gatewayFactory: PaymentGatewayFactory,
    @Inject('PAYMENT_KAFKA') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async initiatePayment(dto: InitiatePaymentDto): Promise<Payment> {
    const existing = await this.paymentRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      this.logger.log(`
            Duplicate idempotency key ${dto.idempotencyKey} found, returning existing payment
            `);
      return existing;
    }

    const gateway = dto.provider
      ? this.gatewayFactory.getByProvider(dto.provider)
      : this.gatewayFactory.getDefault();

    const payment = this.paymentRepo.create({
      bookingId: dto.bookingId,
      idempotencyKey: dto.idempotencyKey,
      amount: dto.amount,
      currency: dto.currency,
      method: dto.method,
      status: PaymentStatus.INITIATED,
      provider: gateway.name,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    try {
      savedPayment.status = PaymentStatus.PROCESSING;
      await this.paymentRepo.save(savedPayment);

      const response = await gateway.charge({
        amount: dto.amount,
        currency: dto.currency,
        cardToken: dto.cardToken,
        idempotencyKey: dto.idempotencyKey,
      });

      if (response.success) {
        savedPayment.status = PaymentStatus.SUCCEEDED;
        savedPayment.providerTxId = response.providerTxId!;
        savedPayment.paidAt = new Date();
        await this.paymentRepo.save(savedPayment);

        this.kafkaClient.emit('payment.succeded', {
          key: savedPayment.id.toString(),
          value: {
            paymentId: savedPayment.id.toString(),
            bookingId: savedPayment.bookingId,
            amount: savedPayment.amount,
            currency: savedPayment.currency,
            provider: savedPayment.provider,
            providerTxId: savedPayment.providerTxId,
            paidAt: savedPayment.paidAt,
          },
        });

        this.logger.log(`
            Payment ${savedPayment.id} succeeded with provider tx id ${savedPayment.providerTxId}
            `);
      } else {
        savedPayment.status = PaymentStatus.FAILED;
        savedPayment.failureReason = response.failureReason!;
        await this.paymentRepo.save(savedPayment);

        this.kafkaClient.emit('payment.failed', {
          key: savedPayment.id.toString(),
          value: {
            paymentId: savedPayment.id.toString(),
            bookingId: savedPayment.bookingId,
            reason: response.failureReason,
            provider: savedPayment.provider,
          },
        });

        this.logger.log(`
            Payment ${savedPayment.id} failed with failure reason ${savedPayment.failureReason}
            `);
      }

      return savedPayment;
    } catch (error) {
      savedPayment.status = PaymentStatus.FAILED;
      savedPayment.failureReason = error.message;
      await this.paymentRepo.save(savedPayment);

      this.kafkaClient.emit('payment.failed', {
        key: savedPayment.id.toString(),
        value: {
          paymentId: savedPayment.id.toString(),
          bookingId: savedPayment.bookingId,
          reason: error.message,
          provider: savedPayment.provider,
        },
      });

      this.logger.log(`
            Payment ${savedPayment.id} failed with error ${error.message}
            `);

      throw error;
    }
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByBookingId(bookingId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { bookingId },
    });
  }
}
