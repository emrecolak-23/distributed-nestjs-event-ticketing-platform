import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../enums';
import { PaymentProvider } from '../gateways/payment-provider.enum';

export class InitiatePaymentDto {
  @IsString()
  bookingId: string;

  @IsString()
  idempotencyKey: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  cardToken: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;
}
