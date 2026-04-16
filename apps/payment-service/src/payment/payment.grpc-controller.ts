import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { PaymentMethod, RefundStatus } from './enums';
import { PaymentProvider } from './gateways/payment-provider.enum';
import { RefundService } from './refund.service';

@Controller()
export class PaymentGrpcController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
  ) {}

  @GrpcMethod('PaymentService', 'InitiatePayment')
  async initiatePayment(data: {
    bookingId: string;
    idempotencyKey: string;
    amount: number;
    currency: string;
    method: string;
    cardToken: string;
    provider?: string;
  }) {
    const payment = await this.paymentService.initiatePayment({
      bookingId: data.bookingId,
      idempotencyKey: data.idempotencyKey,
      amount: data.amount,
      currency: data.currency,
      method: data.method as PaymentMethod,
      cardToken: data.cardToken,
      provider: data.provider as PaymentProvider,
    });

    return {
      payment: this.toPaymentInfo(payment),
    };
  }

  @GrpcMethod('PaymentService', 'GetPayment')
  async getPayment(data: { id: string }) {
    const payment = await this.paymentService.findById(data.id);

    return {
      payment: this.toPaymentInfo(payment),
    };
  }

  @GrpcMethod('PaymentService', 'GetPaymentsByBooking')
  async getPaymentsByBooking(data: { bookingId: string }) {
    const payments = await this.paymentService.findByBookingId(data.bookingId);

    return {
      payments: payments.map((payment) => this.toPaymentInfo(payment)),
    };
  }

  private toPaymentInfo(payment: any) {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      idempotencyKey: payment.idempotencyKey,
      amount: String(payment.amount),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      provider: payment.provider,
      providerTxId: payment.providerTxId || '',
      failureReason: payment.failureReason || '',
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : '',
    };
  }

  @GrpcMethod('PaymentService', 'RefundPayment')
  async refundPayment(data: {
    bookingId: string;
    idempotencyKey: string;
    reason?: string;
  }) {
    try {
      const refund = await this.refundService.refundByBooking(
        data.bookingId,
        data.idempotencyKey,
        data.reason,
      );

      return {
        success: refund.status === RefundStatus.PROCESSED,
        refundId: refund.id,
        failureReason: refund.failureReason || '',
      };
    } catch (error) {
      return {
        success: false,
        refundId: '',
        failureReason: error.message || '',
      };
    }
  }
}
