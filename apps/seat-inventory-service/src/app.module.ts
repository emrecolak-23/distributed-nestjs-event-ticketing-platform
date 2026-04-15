import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from './inventory/inventory.module';
import { PostgresDatabaseModule } from '@app/database';
import { HoldModule } from './hold/hold.module';
import { RedisModule } from '@app/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/seat-inventory-service/.env',
    }),
    PostgresDatabaseModule,
    RedisModule.register(),
    InventoryModule,
    HoldModule,
  ],
})
export class AppModule {}
