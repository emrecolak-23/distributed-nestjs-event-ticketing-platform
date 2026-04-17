import {
  Controller,
  Req,
  Res,
  Get,
  Post,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public, Roles, RolesGuard } from '@app/auth-guard';
import { ProxyService } from '../proxy.service';

@Controller('api/events')
export class EventProxyController {
  private readonly eventServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.eventServiceUrl = this.configService.get<string>('EVENT_SERVICE_URL', '');
    if (!this.eventServiceUrl) {
      throw new InternalServerErrorException(
        'EVENT_SERVICE_URL is not configured',
      );
    }
  }

  @Get()
  @Public()
  findAll(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(this.eventServiceUrl, req, res);
  }

  @Get('*')
  @Public()
  findOne(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(this.eventServiceUrl, req, res);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'organizer')
  create(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(this.eventServiceUrl, req, res);
  }
}
