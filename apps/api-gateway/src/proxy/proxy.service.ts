import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly http: HttpService) {}

  async forward(target: string, req: Request, res: Response): Promise<void> {
    const url = `${target}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    const skipHeaders = ['host', 'connection', 'content-length'];

    for (const [key, value] of Object.entries(req.headers)) {
      if (!skipHeaders.includes(key)) {
        headers[key] = value as string;
      }
    }

    if ((req as any).user) {
      const user = (req as any).user;
      headers['x-user-id'] = user.id;
      headers['x-user-email'] = user.email;
      headers['x-user-role'] = user.role;
      headers['x-user-email-verified'] = user.emailVerified.toString();
    }

    try {
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url,
          headers,
          data: req.body,
          validateStatus: () => true,
          timeout: 30000,
        }),
      );

      const responseHeaders = response.headers;

      for (const [key, value] of Object.entries(responseHeaders)) {
        if (value && key !== 'transfer-encoding') {
          res.setHeader(key, value as string);
        }
      }

      res.status(response.status).send(response.data);
    } catch (error) {
      this.logger.error(`Proxy error: ${error.message}`);
      res.status(502).json({
        statusCode: 502,
        message: `Service ${target} is not available`,
      });
    }
  }
}
