import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from './inventory/inventory.module';
import { PostgresDatabaseModule } from '@app/database';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/seat-inventory-service/.env',
    }),
    PostgresDatabaseModule,
    InventoryModule,
  ],
})
export class AppModule {}
