import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
  Inject,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';
import { RateLimitConfig } from './rate-limit.interface';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit =
  (config: RateLimitConfig) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor?.value || target);
  };

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    const config = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!config) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const key = `rate-limit:${ip}:${request.method}:${request.url}`;

    try {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      await this.redis.zremrangebyscore(key, 0, windowStart);
      const count = await this.redis.zcard(key);

      response.setHeader('X-RateLimit-Limit', config.max);
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.max - count - 1),
      );

      if (count >= config.max) {
        const oldestEntry = await this.redis.zrange(key, 0, 0);
        const resetTime =
          oldestEntry.length > 1
            ? parseInt(oldestEntry[1]) + config.windowMs
            : now + config.windowMs;
        response.setHeader('X-RateLimit-Reset', resetTime);
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        this.logger.warn(
          `Rate limit exceeded for ${ip} on ${request.method} ${request.url}`,
        );
        throw new HttpException(
          {
            statusCode: 429,
            message: 'Too many requests, please try again later',
            retryAfter,
          },
          429,
        );
      }

      await this.redis.zadd(key, now, `${now}:${Math.random()}`);
      await this.redis.pexpire(key, config.windowMs);
      return next.handle();
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Rate limit error: ${error.message}`);
      return next.handle();
    }
  }
}
