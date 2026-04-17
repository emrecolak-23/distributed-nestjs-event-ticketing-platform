import { ServiceConfig } from './service-config.interface';

const getRequiredServiceUrl = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

export const getServiceRegistry = (): ServiceConfig[] => [
  {
    name: 'auth-service',
    target: getRequiredServiceUrl('AUTH_SERVICE_URL'),
    pathPrefix: '/api/auth',
    isPublicPaths: [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
    ],
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 20,
    },
  },
  {
    name: 'event-service',
    target: getRequiredServiceUrl('EVENT_SERVICE_URL'),
    pathPrefix: '/api/events',
    isPublicPaths: ['/api/events', '/api/events/*'],
  },
  {
    name: 'event-service-venues',
    target: getRequiredServiceUrl('VENUES_SERVICE_URL'),
    pathPrefix: '/api/venues',
    isPublicPaths: ['/api/venues', '/api/venues/*', '/api/venues/*/layout'],
  },
  {
    name: 'seat-inventory-service',
    target: getRequiredServiceUrl('INVENTORY_SERVICE_URL'),
    pathPrefix: '/api/inventory',
    isPublicPaths: [
      '/api/inventory/events/*',
      '/api/inventory/events/*/available',
    ],
  },
  {
    name: 'seat-inventory-holds',
    target: getRequiredServiceUrl('HOLDS_SERVICE_URL'),
    pathPrefix: '/api/holds',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 10,
    },
  },
  {
    name: 'booking-service',
    target: getRequiredServiceUrl('BOOKING_SERVICE_URL'),
    pathPrefix: '/api/bookings',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 5,
    },
  },
  {
    name: 'booking-service-tickets',
    target: getRequiredServiceUrl('BOOKING_SERVICE_URL'),
    pathPrefix: '/api/tickets',
  },
  {
    name: 'payment-service',
    target: getRequiredServiceUrl('PAYMENT_SERVICE_URL'),
    pathPrefix: '/api/payments',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 5,
    },
  },
];
