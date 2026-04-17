export interface ServiceConfig {
  name: string;
  target: string;
  pathPrefix: string;
  isPublicPaths?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}
