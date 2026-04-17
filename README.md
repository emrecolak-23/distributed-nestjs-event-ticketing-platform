# Ticketing Platform

Event ticketing microservices platform built with NestJS.

## Architecture

| Service         | Port | DB         | Description                                |
| --------------- | ---- | ---------- | ------------------------------------------ |
| API Gateway     | 8080 | —          | Rate limiting, auth, routing               |
| Auth Service    | 3000 | PostgreSQL | JWT auth, registration, email verification |
| Event Service   | 3001 | MongoDB    | Venue/event management                     |
| Seat Inventory  | 3002 | PostgreSQL | Seat locking, holds, CQRS read model       |
| Booking Service | 3003 | PostgreSQL | Booking orchestration, tickets/QR          |
| Payment Service | 3004 | PostgreSQL | Stripe payments, refunds                   |
| Notification    | 3005 | PostgreSQL | Email notifications                        |

## Tech Stack

- **Framework:** NestJS (monorepo)
- **Databases:** PostgreSQL, MongoDB
- **Cache/Lock:** Redis
- **Message Broker:** Kafka
- **Payment:** Stripe
- **gRPC:** Service-to-service sync communication
- **Email:** Nodemailer + Mailhog (dev)

## Patterns

- Outbox Pattern (guaranteed event delivery)
- Saga / State Machine (refund flow)
- CQRS (Redis read model for seat availability)
- Factory Pattern (payment gateway abstraction)
- Pessimistic Locking (Redis SETNX)
- Idempotency (Redis interceptor + DB unique key)
- Sliding Window Rate Limiting (Redis sorted set)

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- protoc (for gRPC code generation)

## Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/ticketing-platform.git
cd ticketing-platform

# Install dependencies
pnpm install

# Copy environment files
cp .env.shared.example .env.shared
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/event-service/.env.example apps/event-service/.env
cp apps/seat-inventory-service/.env.example apps/seat-inventory-service/.env
cp apps/booking-service/.env.example apps/booking-service/.env
cp apps/payment-service/.env.example apps/payment-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env
cp apps/api-gateway/.env.example apps/api-gateway/.env

# Edit .env.shared and service-specific .env files with your values

# Start infrastructure
docker compose up -d

# Generate gRPC types
pnpm run proto:generate

# Start services (each in a separate terminal)
nest start auth-service --watch
nest start event-service --watch
nest start seat-inventory-service --watch
nest start booking-service --watch
nest start payment-service --watch
nest start notification-service --watch
nest start api-gateway --watch
```

## API Documentation (Swagger)

| Service        | Swagger URL                |
| -------------- | -------------------------- |
| Auth           | http://localhost:3000/docs |
| Event          | http://localhost:3001/docs |
| Seat Inventory | http://localhost:3002/docs |
| Booking        | http://localhost:3003/docs |
| Payment        | http://localhost:3004/docs |

## Booking Flow
