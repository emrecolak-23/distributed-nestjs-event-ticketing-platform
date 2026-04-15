import { DynamicModule, Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({})
export class RedisModule {
  static register(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (configService: ConfigService) => {
            return new Redis({
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
            });
          },
          inject: [ConfigService],
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}
