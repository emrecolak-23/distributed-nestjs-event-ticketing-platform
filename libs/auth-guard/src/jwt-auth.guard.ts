import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Reflector } from '@nestjs/core';

const AUTHORIZATION_HEADER = 'authorization';
const AUTHORIZATION_TYPE_BEARER = 'bearer';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private reflector: Reflector,
  ) {
    this.jwtSecret = this.configService.get(
      'JWT_SECRET',
      'your-super-secret-jwt-key-change-this',
    ) as string;
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers[AUTHORIZATION_HEADER];

    if (!authorizationHeader || authorizationHeader.length === 0) {
      throw new UnauthorizedException('Authorization header is not provided');
    }

    const fields = authorizationHeader.split(' ');

    if (fields.length < 2) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const authorizationType = fields[0].toLowerCase();

    if (authorizationType !== AUTHORIZATION_TYPE_BEARER) {
      throw new UnauthorizedException('Invalid authorization type');
    }

    const accessToken = fields[1];

    try {
      const payload = jwt.verify(accessToken, this.jwtSecret) as any;

      request.user = payload;
      return true;
    } catch (error) {
      if ((error.name = 'TokenExpiredError')) {
        throw new UnauthorizedException('Token has expired');
      }

      if ((error.name = 'JsonWebTokenError')) {
        throw new UnauthorizedException('Invalid token');
      }

      throw new UnauthorizedException('Token verification failed');
    }
  }
}
