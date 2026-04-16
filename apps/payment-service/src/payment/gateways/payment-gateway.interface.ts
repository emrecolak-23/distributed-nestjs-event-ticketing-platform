export interface PaymentGatewayRequest {
  amount: number;
  currency: string;
  cardToken: string;
  idempotencyKey: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  providerTxId?: string;
  failureReason?: string;
}

export interface PaymentGateway {
  readonly name: string;
  charge(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse>;
  refund(providerTxId: string, amount: number): Promise<PaymentGatewayResponse>;
}
