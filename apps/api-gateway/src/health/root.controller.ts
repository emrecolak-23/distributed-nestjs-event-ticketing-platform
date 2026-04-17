import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/auth-guard';

@Controller()
@Public()
export class RootController {
  @Get()
  root() {
    return {
      name: 'Ticketing Platform API',
      version: '1.0.0',
      docs: '/health',
    };
  }
}
