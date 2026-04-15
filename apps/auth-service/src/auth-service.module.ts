import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { PostgresDatabaseModule } from '@app/database';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PostgresDatabaseModule],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}
