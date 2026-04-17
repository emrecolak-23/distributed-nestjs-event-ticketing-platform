# 🎫 NestJS Ticketing System

A production-grade event ticketing microservices platform built with NestJS, demonstrating distributed systems patterns including CQRS, Outbox Pattern, Saga/State Machine, and event-driven architecture.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    API Gateway (:8080)                    │
│              Rate Limiting · Auth · Routing               │
└──────────┬──────┬──────┬──────┬──────┬──────┬────────────┘
           │      │      │      │      │      │
     ┌─────┘  ┌───┘  ┌───┘  ┌───┘  ┌───┘  ┌───┘
     ▼        ▼      ▼      ▼      ▼      ▼
  ┌──────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌───────┐ ┌──────────┐
  │ Auth │ │Event │ │  Seat  │ │Booking│ │Payment│ │Notifica- │
  │:3000 │ │:3001 │ │Invent. │ │ :3003 │ │ :3004 │ │  tion    │
  │      │ │      │ │ :3002  │ │       │ │       │ │  :3005   │
  └──┬───┘ └──┬───┘ └──┬─────┘ └──┬────┘ └──┬────┘ └────┬─────┘
     │        │        │          │         │            │
  Postgres  Mongo    Postgres   Postgres  Postgres    Postgres
  (auth_db) (event_db)(seat_db) (booking_db)(payment_db)(notif_db)
     │        │        │          │         │            │
     └────────┴────────┴──── Kafka ─────────┴────────────┘
                       │
                     Redis
              (locks · cache · rate limit)
```

## Services

| Service             | Port | Database   | Transport           | Description                                                  |
| ------------------- | ---- | ---------- | ------------------- | ------------------------------------------------------------ |
| **API Gateway**     | 8080 | —          | HTTP Proxy          | Rate limiting, JWT validation, routing                       |
| **Auth Service**    | 3000 | PostgreSQL | REST + Kafka        | Registration, JWT tokens, email verification, password reset |
| **Event Service**   | 3001 | MongoDB    | REST + Kafka        | Venue management, event CRUD, ticket types                   |
| **Seat Inventory**  | 3002 | PostgreSQL | REST + gRPC + Kafka | Seat locking, holds, CQRS read model                         |
| **Booking Service** | 3003 | PostgreSQL | REST + gRPC + Kafka | Booking orchestration, ticket/QR generation                  |
| **Payment Service** | 3004 | PostgreSQL | REST + gRPC + Kafka | Stripe integration, refunds, idempotency                     |
| **Notification**    | 3005 | PostgreSQL | Kafka consumer      | Email notifications (booking, verification, password reset)  |

## Tech Stack

| Category            | Technology                 |
| ------------------- | -------------------------- |
| **Framework**       | NestJS (monorepo)          |
| **Language**        | TypeScript                 |
| **Databases**       | PostgreSQL 16, MongoDB 7   |
| **Cache & Locking** | Redis 7                    |
| **Message Broker**  | Apache Kafka (Confluent)   |
| **Payment**         | Stripe (test mode)         |
| **gRPC**            | @grpc/grpc-js + ts-proto   |
| **Email**           | Nodemailer + Mailhog (dev) |
| **API Docs**        | Swagger / OpenAPI          |
| **Package Manager** | pnpm                       |

## Design Patterns

### Outbox Pattern

Booking confirmed + outbox entries are written in a single database transaction. A background worker polls the outbox table and processes entries (gRPC calls + Kafka events). This guarantees that if a booking is confirmed, the downstream effects (seat status update, notification) will eventually be processed — even if Kafka or the downstream service is temporarily down.

```
Single Transaction:
  booking → confirmed
  outbox → [seats.mark_sold, booking.confirmed]

Worker (every 30s):
  outbox → gRPC: markSeatsAsSold
  outbox → Kafka: booking.confirmed
```

### Saga / State Machine (Refund Flow)

Each step of the refund process is persisted to the database. If any step fails, the recovery worker picks up from the last successful state and retries.

```
refund_initiated → payment_refunded → seats_released → completed
       ↓                 ↓                  ↓
     failed            failed             failed
     (retry)           (retry)            (retry)
```

### CQRS (Read/Write Separation)

Seat availability queries are served from a Redis read model. Every write operation (hold, sold, release) updates both PostgreSQL and the Redis cache. On cache miss, the read model is rebuilt from PostgreSQL.

```
Write: POST /holds → PostgreSQL + Redis Hash update
Read:  GET /available → Redis Hash (no DB hit)
```

### Pessimistic Locking

Seat-level distributed locks using Redis SETNX with TTL. Atomic lock acquisition prevents double-booking. All-or-nothing semantics — if any seat in a batch fails to lock, all successfully locked seats are released.

### Factory Pattern (Payment Gateway)

Payment gateway is abstracted behind an interface. Runtime selection via environment variable or per-request override. Adding a new gateway requires implementing the interface and registering it in the factory.

```
PaymentGateway interface
  ├── StripeGateway (production)
  ├── IyzicoGateway (placeholder)
  └── MockGateway (testing)
```

### Idempotency

Dual-layer idempotency protection for payment operations:

- **Redis interceptor**: Fast duplicate detection using SETNX
- **Database unique constraint**: Ultimate source of truth on idempotency key

### Sliding Window Rate Limiting

Redis sorted sets for precise rate limiting per IP per endpoint. Rate limit configuration is declarative via decorators on gateway proxy controllers.

## Booking Flow

```
1. Browse events           GET  /api/events
2. View seat map            GET  /api/inventory/events/:id
3. Select seats             POST /api/holds
   → Redis SETNX lock
   → DB status: available → held
   → TTL: 10 minutes

4. Create booking           POST /api/bookings
   → Verify holds (gRPC)
   → Initiate payment (gRPC → Stripe)
   → Single TX: booking confirmed + outbox entries
   → Worker: seats → sold + Kafka event

5. Receive confirmation     Kafka → Notification Service → Email

6. Check in at event        POST /api/tickets/checkin/:code
```

## Refund Flow

```
1. Cancel booking           DELETE /api/bookings/:id
   → State: refund_initiated
   → Stripe refund (gRPC)
   → State: payment_refunded
   → Release seats (gRPC)
   → State: seats_released
   → Single TX: booking refunded + outbox entry
   → State: completed
   → Worker: Kafka event → refund email
```

## Project Structure

```
ticketing-platform/
├── apps/
│   ├── api-gateway/          # Rate limiting, auth, proxy
│   ├── auth-service/         # JWT, registration, verification
│   ├── event-service/        # Venues, events, ticket types
│   ├── seat-inventory-service/ # Locks, holds, CQRS
│   ├── booking-service/      # Orchestrator, tickets, outbox
│   ├── payment-service/      # Stripe, refunds, idempotency
│   └── notification-service/ # Email via Kafka
├── libs/
│   ├── common/               # Shared utilities, Swagger config
│   ├── database/             # PostgreSQL + MongoDB modules
│   ├── kafka/                # Kafka client module
│   ├── redis/                # Redis client module
│   ├── grpc/                 # Proto files + generated types
│   └── auth-guard/           # JWT guard, decorators
├── scripts/
│   ├── init-dbs.sql          # PostgreSQL database init
│   └── proto-generate.sh     # gRPC codegen
├── docker-compose.yml
├── .env.shared.example
└── nest-cli.json
```

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- protoc (Protocol Buffers compiler)
- Stripe account (test mode, free)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/nestjs-ticketing-system.git
cd nestjs-ticketing-system
pnpm install
```

### 2. Configure environment

```bash
cp .env.shared.example .env.shared
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/event-service/.env.example apps/event-service/.env
cp apps/seat-inventory-service/.env.example apps/seat-inventory-service/.env
cp apps/booking-service/.env.example apps/booking-service/.env
cp apps/payment-service/.env.example apps/payment-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env
cp apps/api-gateway/.env.example apps/api-gateway/.env
```

Edit `.env.shared` with your JWT secret, and `apps/payment-service/.env` with your Stripe test key.

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, MongoDB, Redis, Kafka, Zookeeper, and Mailhog.

### 4. Generate gRPC types

```bash
pnpm run proto:generate
```

### 5. Start services

Each service in a separate terminal:

```bash
nest start auth-service --watch           # :3000
nest start event-service --watch          # :3001
nest start seat-inventory-service --watch # :3002
nest start booking-service --watch        # :3003
nest start payment-service --watch        # :3004
nest start notification-service --watch   # :3005
nest start api-gateway --watch            # :8080
```

### 6. Create test data

```bash
# Register a user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password1!","fullName":"Test User"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password1!"}'

# Create a venue (requires admin token)
curl -X POST http://localhost:8080/api/venues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Concert Hall",
    "city": "Istanbul",
    "sections": [{
      "name": "VIP",
      "rows": [{
        "label": "A",
        "seats": [
          {"number": "1", "type": "vip", "x": 100, "y": 50},
          {"number": "2", "type": "vip", "x": 130, "y": 50}
        ]
      }]
    }]
  }'
```

## API Documentation

| Service        | Swagger URL                |
| -------------- | -------------------------- |
| Auth           | http://localhost:3000/docs |
| Event          | http://localhost:3001/docs |
| Seat Inventory | http://localhost:3002/docs |
| Booking        | http://localhost:3003/docs |
| Payment        | http://localhost:3004/docs |

## Service Communication

```
┌─────────────┐    gRPC (sync)     ┌──────────────────┐
│   Booking   │───────────────────▶│  Seat Inventory   │
│   Service   │───────────────────▶│     Service       │
└──────┬──────┘    gRPC (sync)     └──────────────────┘
       │
       │ gRPC (sync)
       ▼
┌─────────────┐
│   Payment   │───── Stripe API
│   Service   │
└──────┬──────┘
       │ Kafka (async)
       ▼
┌──────────────┐    Kafka (async)   ┌──────────────────┐
│    Event     │───────────────────▶│  Seat Inventory   │
│   Service    │                    │  (event.created)  │
└──────────────┘                    └──────────────────┘

┌─────────────┐    Kafka (async)   ┌──────────────────┐
│   Booking   │───────────────────▶│  Notification     │
│   (outbox)  │                    │  (email send)     │
└─────────────┘                    └──────────────────┘

┌─────────────┐    Kafka (async)   ┌──────────────────┐
│    Auth     │───────────────────▶│  Notification     │
│   Service   │                    │  (verify/reset)   │
└─────────────┘                    └──────────────────┘
```

### Sync (gRPC) — user is waiting for response

- Booking → Seat Inventory: hold verification, mark as sold
- Booking → Payment: initiate payment, refund

### Async (Kafka) — fire and forget, eventual consistency

- Event Service → Seat Inventory: event.created (inventory initialization)
- Booking (outbox) → Notification: booking.confirmed, booking.refunded
- Auth → Notification: email verification, password reset

## Mailhog (Dev Email)

All emails in development are captured by Mailhog:

**http://localhost:8025**

## Docker Services

| Service      | Port(s) |
| ------------ | ------- |
| PostgreSQL   | 5432    |
| MongoDB      | 27017   |
| Redis        | 6379    |
| Kafka        | 9092    |
| Zookeeper    | 2181    |
| Mailhog SMTP | 1025    |
| Mailhog UI   | 8025    |

## Environment Variables

### Shared (.env.shared)

| Variable       | Description          | Default        |
| -------------- | -------------------- | -------------- |
| `JWT_SECRET`   | JWT signing secret   | —              |
| `KAFKA_BROKER` | Kafka broker address | localhost:9092 |
| `REDIS_HOST`   | Redis host           | localhost      |
| `REDIS_PORT`   | Redis port           | 6379           |
| `DB_HOST`      | PostgreSQL host      | localhost      |
| `DB_PORT`      | PostgreSQL port      | 5432           |
| `DB_USERNAME`  | PostgreSQL username  | ticketing      |
| `DB_PASSWORD`  | PostgreSQL password  | secret         |

### Payment Service

| Variable            | Description                           |
| ------------------- | ------------------------------------- |
| `STRIPE_SECRET_KEY` | Stripe test secret key (sk*test*...)  |
| `PAYMENT_PROVIDER`  | Default gateway: stripe, mock, iyzico |

### Auth Service

| Variable                    | Description              | Default               |
| --------------------------- | ------------------------ | --------------------- |
| `JWT_ACCESS_EXPIRY`         | Access token TTL         | 15m                   |
| `REFRESH_TOKEN_EXPIRY_DAYS` | Refresh token TTL        | 30                    |
| `APP_URL`                   | Base URL for email links | http://localhost:8080 |

## Data Consistency Guarantees

| Operation                | Consistency         | Mechanism                       |
| ------------------------ | ------------------- | ------------------------------- |
| Seat hold                | Strong              | Redis SETNX + DB transaction    |
| Booking → Sold           | Guaranteed eventual | Outbox pattern + worker retry   |
| Payment                  | Strong + Idempotent | gRPC sync + idempotency key     |
| Refund                   | Resumable           | State machine + recovery worker |
| Notification             | Eventual            | Kafka async (acceptable delay)  |
| Seat availability (read) | Eventual            | CQRS Redis cache                |

## License

MIT
