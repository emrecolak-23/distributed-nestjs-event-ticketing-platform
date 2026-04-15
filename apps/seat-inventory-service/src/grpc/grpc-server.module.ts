import { Module } from '@nestjs/common';
import { InventoryGrpcController } from '../inventory/inventory.grpc-controller';
import { InventoryModule } from '../inventory/inventory.module';
import { HoldModule } from '../hold/hold.module';

@Module({
  imports: [InventoryModule, HoldModule],
  controllers: [InventoryGrpcController],
})
export class GrpcServerModule {}
