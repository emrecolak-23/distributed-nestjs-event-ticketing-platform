import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';

import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly TTL_SECONDS = 3600;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:payment:${idempotencyKey}`;
    return from(this.redis.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          const data = JSON.parse(cached);
          if (data.status === 'processing') {
            throw new ConflictException('Payment already in progress');
          }
          this.logger.log(
            `Returning cached response for key ${idempotencyKey}`,
          );
          return of(data.response);
        }

        return from(
          this.redis.set(
            cacheKey,
            JSON.stringify({ status: 'processing' }),
            'EX',
            this.TTL_SECONDS,
            'NX',
          ),
        ).pipe(
          switchMap((result) => {
            if (result !== 'OK') {
              throw new ConflictException(
                'Request with this idempotency key is already being processed',
              );
            }

            return next.handle().pipe(
              tap(async (response) => {
                await this.redis.set(
                  cacheKey,
                  JSON.stringify({ status: 'completed', response }),
                  'EX',
                  this.TTL_SECONDS,
                );
              }),
            );
          }),
        );
      }),
    );
  }
}
