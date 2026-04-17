import {
  Controller,
  All,
  Req,
  Res,
  UseInterceptors,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ProxyService } from '../proxy.service';
import {
  RateLimit,
  RateLimitInterceptor,
} from '../../rate-limit/rate-limit.interceptor';

@Controller('api/payments')
@UseInterceptors(RateLimitInterceptor)
@RateLimit({ windowMs: 60 * 1000, max: 10 })
export class PaymentProxyController {
  private readonly paymentServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.paymentServiceUrl = this.configService.get<string>(
      'PAYMENT_SERVICE_URL',
      '',
    );
    if (!this.paymentServiceUrl) {
      throw new InternalServerErrorException(
        'PAYMENT_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.paymentServiceUrl, req, res);
  }
}
