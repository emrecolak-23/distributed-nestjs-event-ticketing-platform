import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';
import { getServiceRegistry } from '../proxy/service-registry';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly serviceRegistry = getServiceRegistry();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const matchedService = this.serviceRegistry.find((s) => {
      return req.path.startsWith(s.pathPrefix);
    });

    if (!matchedService?.rateLimit) {
      return next();
    }

    const { windowMs, max } = matchedService.rateLimit;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `ratelimit:${ip}:${matchedService.pathPrefix}`;

    try {
      const current = await this.redis.incr(key);

      if (current === 1) {
        await this.redis.pexpire(key, windowMs);
      }

      const tll = await this.redis.pttl(key);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + tll);

      if (current > max) {
        this.logger.warn(
          `Rate limit exceeded for ${matchedService.name} by IP: ${ip}`,
        );
        return res.status(429).json({
          statusCode: 429,
          message: 'Too many requests',
          retryAfter: Math.ceil(tll / 1000),
        });
      }

      next();
    } catch (error) {
      this.logger.error(`Rate limit error: ${error.message}`);
      next();
    }
  }
}
