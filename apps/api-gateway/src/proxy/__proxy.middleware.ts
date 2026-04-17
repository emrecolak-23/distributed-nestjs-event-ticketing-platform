import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getServiceRegistry } from './service-registry';
import { ServiceConfig } from './service-config.interface';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);
  private readonly proxies: Map<string, RequestHandler> = new Map();
  private readonly serviceRegistry = getServiceRegistry();

  constructor() {
    for (const service of this.serviceRegistry) {
      const proxy = createProxyMiddleware({
        target: service.target,
        changeOrigin: true,
        on: {
          proxyReq: (proxyReq, req: any, res) => {
            if (req.user) {
              proxyReq.setHeader('x-user-id', req.user.id);
              proxyReq.setHeader('x-user-email', req.user.email);
              proxyReq.setHeader('x-user-role', req.user.role);
              proxyReq.setHeader(
                'x-user-email-verified',
                String(req.user.emailVerified),
              );
            }
          },
          error: (err, req, res: any) => {
            this.logger.error(
              `Proxy error for ${service.name}: ${err.message}`,
            );

            res.status(502).json({
              statusCode: 502,
              message: `Service ${service.name} is not available`,
            });
          },
        },
      });

      this.proxies.set(service.pathPrefix, proxy);
      this.logger.log(
        `Proxy registered: ${service.pathPrefix} -> ${service.target}`,
      );
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    this.logger.debug(`Proxy lookup: ${req.method} ${path}`);
    const matchedPrefix = this.findMatchingPrefix(path);
    if (!matchedPrefix) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Route not found',
      });
    }

    const proxy = this.proxies.get(matchedPrefix);
    if (!proxy) {
      return res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    }

    return proxy(req, res, next);
  }

  private findMatchingPrefix(path: string): string | null {
    const sorted = [...this.proxies.keys()].sort((a, b) => b.length - a.length);
    for (const prefix of sorted) {
      if (path.startsWith(prefix)) {
        return prefix;
      }
    }
    return null;
  }
}
