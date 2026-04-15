import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';
import { EventCreateMessage } from '@app/common';

@Controller()
export class InventoryConsumer {
  private readonly logger = new Logger(InventoryConsumer.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @EventPattern('event.create')
  async handleEventCreate(@Payload() payload: any) {
    const message = (payload?.value ?? payload) as EventCreateMessage;

    if (!message?.eventId) {
      this.logger.error('Received invalid event.create payload');
      return;
    }

    this.logger.log(`Received event.create: ${message.eventId}`);
    await this.inventoryService.createFromEvent(message);
  }
}
