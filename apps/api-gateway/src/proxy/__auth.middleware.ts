import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { getServiceRegistry } from './service-registry';
import { PublicRoute } from './public-route.interface';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  private readonly jwtSecret: string;
  private readonly publicRoutes: PublicRoute[] = [];
  private readonly serviceRegistry = getServiceRegistry();

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'your-secret-key',
    );
    this.buildPublicRoutes();
    this.logger.log(`Loaded ${this.publicRoutes.length} public routes`);
  }

  private buildPublicRoutes() {
    for (const service of this.serviceRegistry) {
      if (service.isPublicPaths && service.isPublicPaths.length > 0) {
        for (const path of service.isPublicPaths) {
          const escaped = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '[^/]+');

          const pattern = new RegExp(`^${escaped}\\/?$`);
          this.publicRoutes.push({ pattern });
        }
      }
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    this.logger.debug(`Auth check: ${req.method} ${path}`);

    if (this.isPublicPath(path)) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Authorization header is not provided',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = jwt.verify(token, this.jwtSecret) as {
        sub: string;
        email: string;
        role: string;
        emailVerified: boolean;
      };

      (req as any).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        emailVerified: payload.emailVerified,
      };

      next();
    } catch (error) {
      const message =
        error.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : 'Invalid access token';

      return res.status(401).json({
        statusCode: 401,
        message,
      });
    }
  }

  private isPublicPath(path: string): boolean {
    return this.publicRoutes.some((route) => route.pattern.test(path));
  }
}
