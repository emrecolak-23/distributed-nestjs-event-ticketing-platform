import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymentGateway } from './payment-gateway.interface';

import { PaymentProvider } from './payment-provider.enum';

import { StripeGateway } from './stripe.gateway';
import { IyzicoGateway } from './iyzico.gateway';

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);
  private readonly gateways: Map<string, PaymentGateway>;
  private readonly defaultProvider: PaymentProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly stripeGateway: StripeGateway,
    private readonly iyzicoGateway: IyzicoGateway,
  ) {
    this.gateways = new Map<string, PaymentGateway>([
      [PaymentProvider.STRIPE, this.stripeGateway],
      [PaymentProvider.IYZICO, this.iyzicoGateway],
    ]);

    this.defaultProvider = (this.configService.get<string>(
      'PAYMENT_DEFAULT_PROVIDER',
    ) || PaymentProvider.STRIPE) as PaymentProvider;

    this.logger.log(`Default payment provider: ${this.defaultProvider}`);
  }

  getDefault(): PaymentGateway {
    return this.getByProvider(this.defaultProvider);
  }

  getByProvider(provider: string): PaymentGateway {
    const gateway = this.gateways.get(provider);

    if (!gateway) {
      throw new Error(`Payment provider ${provider} not support`);
    }

    return gateway;
  }

  getDefaultProviderName(): string {
    return this.defaultProvider;
  }
}
