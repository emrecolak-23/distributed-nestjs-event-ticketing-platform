import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway,
  PaymentGatewayRequest,
  PaymentGatewayResponse,
} from './payment-gateway.interface';

@Injectable()
export class IyzicoGateway implements PaymentGateway {
  readonly name = 'iyzico';
  private readonly logger = new Logger(IyzicoGateway.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get('IYZICO_API_KEY');
    const secretKey = config.get('IYZICO_SECRET_KEY');
  }

  async charge(
    request: PaymentGatewayRequest,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(`Iyzico charge: ${request.amount} ${request.currency}`);

    // TODO: Iyzipay SDK

    return {
      success: false,
      failureReason: 'Iyzico gateway not implemented yet',
    };
  }

  async refund(
    providerTxId: string,
    amount: number,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(`Iyzico refund: ${providerTxId}, amount: ${amount}`);

    // TODO: Iyzipay SDK

    return {
      success: false,
      failureReason: 'Iyzico refund not implemented yet',
    };
  }
}
