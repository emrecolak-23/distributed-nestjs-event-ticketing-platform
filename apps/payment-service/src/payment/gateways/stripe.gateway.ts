import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ClientStripe, { type Stripe } from 'stripe';
import {
  PaymentGateway,
  PaymentGatewayRequest,
  PaymentGatewayResponse,
} from './payment-gateway.interface';

@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly logger = new Logger(StripeGateway.name);
  readonly name = 'stripe';
  private readonly stripe: Stripe;
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_MS = 500;

  private readonly RETRYABLE_ERROR_TYPES = [
    'StripeConnectionError', // Network hatası
    'StripeAPIError', // Stripe tarafında 5xx
    'StripeRateLimitError', // 429 - rate limit
  ];

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    this.stripe = new ClientStripe(secretKey, {
      maxNetworkRetries: 0,
    });
  }

  async charge(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse> {
    return this.withRetry(
      () => this.doCharge(request),
      `charge:${request.idempotencyKey}`,
    );
  }

  private async doCharge(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(`Stripe charge: ${request.amount} ${request.currency}`);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(request.amount * 100),
          currency: request.currency.toLowerCase(),
          payment_method: request.cardToken,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
        },
        {
          idempotencyKey: request.idempotencyKey,
        },
      );

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          providerTxId: paymentIntent.id,
        };
      }

      return {
        success: false,
        failureReason: `Payment status: ${paymentIntent.status}`,
      };
    } catch (error) {
      this.logger.error(`Stripe charge failed: ${error.message}`);
      return {
        success: false,
        failureReason: error.message,
      };
    }
  }

  async refund(
    providerTxId: string,
    amount: number,
  ): Promise<PaymentGatewayResponse> {
    return this.withRetry(
      () => this.doRefund(providerTxId, amount),
      `refund:${providerTxId}`,
    );
  }

  private async doRefund(
    providerTxId: string,
    amount: number,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(`Stripe refund: ${providerTxId}, amount: ${amount}`);

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: providerTxId,
        amount: Math.round(amount * 100),
      });

      return {
        success: refund.status === 'succeeded',
        providerTxId: refund.id,
      };
    } catch (error) {
      this.logger.error(`Stripe refund failed: ${error.message}`);
      return {
        success: false,
        failureReason: error.message,
      };
    }
  }

  private async withRetry(
    fn: () => Promise<PaymentGatewayResponse>,
    context: string,
  ): Promise<PaymentGatewayResponse> {
    let lastError: any;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          this.logger.warn(
            `[${context}] Non-retryable error on attempt ${attempt}: ${error.type || error.name} - ${error.message}`,
          );

          return {
            success: false,
            failureReason: error.message,
          };
        }

        if (attempt === this.MAX_RETRIES) {
          this.logger.error(
            `[${context}] Failed after ${attempt} attempts: ${error.message}`,
          );
          break;
        }

        const backoff = this.INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);

        this.logger.warn(
          `[${context}] Retryable error on attempt ${attempt}, retrying in ${backoff}ms: ${error.message}`,
        );

        await this.sleep(backoff);
      }

      return {
        success: false,
        failureReason: lastError?.message || 'Payment failed after retries',
      };
    }

    return {
      success: false,
      failureReason: `Failed to ${context} after 3 attempts`,
    };
  }

  private isRetryable(error: any): boolean {
    if (!error) return false;

    const errorType = error.type || error.constructor.name;

    if (this.RETRYABLE_ERROR_TYPES.includes(errorType)) {
      return true;
    }

    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    if (error.type === 'StripeCardError') {
      return false;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
