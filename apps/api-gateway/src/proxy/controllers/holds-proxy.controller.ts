import { Public } from '@app/auth-guard';
import {
  Controller,
  Req,
  Res,
  All,
  UseInterceptors,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import type { Request, Response } from 'express';
import {
  RateLimit,
  RateLimitInterceptor,
} from '../../rate-limit/rate-limit.interceptor';

@Controller('api/holds')
@UseInterceptors(RateLimitInterceptor)
@RateLimit({ windowMs: 60 * 1000, max: 10 })
@Public()
export class HoldsProxyController {
  private readonly holdsServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.holdsServiceUrl = this.configService.get<string>('HOLDS_SERVICE_URL', '');
    if (!this.holdsServiceUrl) {
      throw new InternalServerErrorException(
        'HOLDS_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.holdsServiceUrl, req, res);
  }
}
