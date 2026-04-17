import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { AuthProxyController } from './controllers/auth-proxy.controller';
import { EventProxyController } from './controllers/event-proxy.controller';
import { VenueProxyController } from './controllers/venues-proxy.controller';
import { InventoryProxyController } from './controllers/inventory-proxy.controller';
import { HoldsProxyController } from './controllers/holds-proxy.controller';
import { BookingProxyController } from './controllers/booking-proxy.controller';
import { PaymentProxyController } from './controllers/payment-proxy.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
    }),
  ],
  controllers: [
    AuthProxyController,
    EventProxyController,
    VenueProxyController,
    InventoryProxyController,
    HoldsProxyController,
    BookingProxyController,
    PaymentProxyController,
  ],
  providers: [ProxyService],
})
export class ProxyModule {}
