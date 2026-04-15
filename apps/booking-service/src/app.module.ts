import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PostgresDatabaseModule } from '@app/database';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PostgresDatabaseModule],
  controllers: [],
  providers: [],
})
export class BookingServiceModule {}
