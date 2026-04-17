import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/auth-guard';
@Controller('health')
@Public()
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: [
        { name: 'auth-service', url: 'http://localhost:3000' },
        { name: 'event-service', url: 'http://localhost:3001' },
        { name: 'seat-inventory-service', url: 'http://localhost:3002' },
        { name: 'booking-service', url: 'http://localhost:3003' },
        { name: 'payment-service', url: 'http://localhost:3004' },
        { name: 'notification-service', url: 'http://localhost:3005' },
      ],
    };
  }
}
