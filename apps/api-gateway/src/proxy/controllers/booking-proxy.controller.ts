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

@Controller('api/bookings')
@UseInterceptors(RateLimitInterceptor)
@RateLimit({ windowMs: 60 * 1000, max: 5 })
export class BookingProxyController {
  private readonly bookingServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.bookingServiceUrl = this.configService.get<string>(
      'BOOKING_SERVICE_URL',
      '',
    );
    if (!this.bookingServiceUrl) {
      throw new InternalServerErrorException(
        'BOOKING_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.bookingServiceUrl, req, res);
  }
}

@Controller('api/tickets')
export class TicketProxyController {
  private readonly bookingServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.bookingServiceUrl = this.configService.get<string>(
      'BOOKING_SERVICE_URL',
      '',
    );
    if (!this.bookingServiceUrl) {
      throw new InternalServerErrorException(
        'BOOKING_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.bookingServiceUrl, req, res);
  }
}
