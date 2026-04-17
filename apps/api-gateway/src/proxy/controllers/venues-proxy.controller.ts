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

@Controller('api/venues')
export class VenueProxyController {
  private readonly venuesServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.venuesServiceUrl = this.configService.get<string>('VENUES_SERVICE_URL', '');
    if (!this.venuesServiceUrl) {
      throw new InternalServerErrorException(
        'VENUES_SERVICE_URL is not configured',
      );
    }
  }

  @Get()
  @Public()
  findAll(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.venuesServiceUrl, req, res);
  }

  @Get('*')
  @Public()
  findOne(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.venuesServiceUrl, req, res);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'organizer')
  create(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.venuesServiceUrl, req, res);
  }
}
