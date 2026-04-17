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
import { Public } from '@app/auth-guard';
import { ProxyService } from '../proxy.service';
import {
  RateLimit,
  RateLimitInterceptor,
} from '../../rate-limit/rate-limit.interceptor';

@Controller('api/auth')
@UseInterceptors(RateLimitInterceptor)
@RateLimit({ windowMs: 15 * 60 * 1000, max: 20 })
@Public()
export class AuthProxyController {
  private readonly authServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL', '');
    if (!this.authServiceUrl) {
      throw new InternalServerErrorException(
        'AUTH_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(this.authServiceUrl, req, res);
  }
}
