import {
  Controller,
  Req,
  Res,
  All,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '@app/auth-guard';
import { ProxyService } from '../proxy.service';

@Controller('api/inventory')
@Public()
export class InventoryProxyController {
  private readonly inventoryServiceUrl: string;

  constructor(
    private readonly proxy: ProxyService,
    private readonly configService: ConfigService,
  ) {
    this.inventoryServiceUrl = this.configService.get<string>(
      'INVENTORY_SERVICE_URL',
      '',
    );
    if (!this.inventoryServiceUrl) {
      throw new InternalServerErrorException(
        'INVENTORY_SERVICE_URL is not configured',
      );
    }
  }

  @All('*')
  handle(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(this.inventoryServiceUrl, req, res);
  }
}
