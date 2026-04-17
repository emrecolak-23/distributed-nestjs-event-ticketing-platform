import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from './inventory/inventory.module';
import { PostgresDatabaseModule } from '@app/database';
import { HoldModule } from './hold/hold.module';
import { RedisModule } from '@app/redis';
import { GrpcServerModule } from './grpc/grpc-server.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@app/auth-guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/seat-inventory-service/.env', '.env.shared'],
    }),
    PostgresDatabaseModule,
    RedisModule.register(),
    InventoryModule,
    HoldModule,
    GrpcServerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
