# telegram-notifier

Microservice-based Telegram notification system.

## Services

- `producer` - Nest.js Producer service that accepts events and publishes them to RabbitMQ.
- `consumer` - Nest.js Consumer service that reads notification events from RabbitMQ and sends Telegram messages.
- `panel` - Next.js test panel for sending Telegram notification events to the Producer API.
- `prometheus` - metrics storage and alert rule evaluation.
- `grafana` - local observability dashboard.

## Docker Compose

The whole stack can run with one Docker Compose command:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token docker compose up --build
```

If you do not need real Telegram delivery yet, omit the token and the services
will still start:

```bash
docker compose up --build
```

Docker Compose starts:

- Producer API: `http://localhost:3000`
- Consumer API: `http://localhost:3002`
- Panel: `http://localhost:3001`
- RabbitMQ Management UI: `http://localhost:15672` (`guest` / `guest`)
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3003` (`admin` / `admin`)

Runtime-only Telegram settings can also be placed in a local root `.env` file:

```bash
cp .env.example .env
```

Then set `TELEGRAM_BOT_TOKEN` locally. `.env` files are ignored by Git, so the
bot token must not be committed.

## Observability

Producer and Consumer expose Prometheus metrics:

- Producer metrics: `http://localhost:3000/metrics`
- Consumer metrics: `http://localhost:3002/metrics`
- RabbitMQ metrics: `http://localhost:15692/metrics`

Prometheus scrapes all three targets and loads alert rules from
`observability/prometheus/alert-rules.yml`. Grafana provisions the Prometheus
datasource and the `Telegramify Overview` dashboard on startup.

The dashboard tracks:

- service availability for Producer, Consumer, and RabbitMQ
- HTTP request rate, 5xx rate, and p95 latency
- RabbitMQ publish outcomes, retries, consumer processing, requeues, and rejects
- Telegram Bot API request success/error/missing-token outcomes
- Telegram delivery outcomes for single-chat and broadcast notifications
- known Telegram chats and broadcast fan-out size
- RabbitMQ queue depth for `telegramify.notifications`

The bundled alert rules cover service downtime, high HTTP error rate, high p95
latency, RabbitMQ publish failures, rejected consumer messages, and Telegram Bot
API failures.

## Producer service

Start RabbitMQ:

```bash
docker compose up -d rabbitmq
```

RabbitMQ Management UI is available at `http://localhost:15672`.

Credentials:

- username: `guest`
- password: `guest`

Start the Producer service:

```bash
cd producer
npm install
HOST=127.0.0.1 PORT=3000 npm run start:dev
```

By default the service starts on `http://127.0.0.1:3000`.

## Notification panel

```bash
cd panel
npm install
npm run build
npm run start
```

By default the panel starts on `http://127.0.0.1:3001` and proxies requests to `http://127.0.0.1:3000`.

Available endpoints:

- `GET /health` - service health check
- `GET /metrics` - Prometheus metrics
- `POST /producer/events` - publish an event to RabbitMQ
- `POST /producer/telegram-notifications` - publish a Telegram notification event to RabbitMQ
- `GET /api/docs` - Swagger UI

### Telegram notification event contract

Use `targetType: "single"` when the notification is for one Telegram chat:

```json
{
  "targetType": "single",
  "chatId": "123456789",
  "message": "Hello from Telegramify",
  "parseMode": "HTML",
  "disableNotification": false
}
```

Use `targetType: "broadcast"` when the Consumer should fan out the message to all known chats:

```json
{
  "targetType": "broadcast",
  "message": "System maintenance starts at 21:00",
  "metadata": {
    "source": "admin-panel"
  }
}
```

Both requests publish the RabbitMQ event type `telegram.notification.requested`. The Consumer reads the event envelope and sends `payload.message.text` to either `payload.target.chatId` or every broadcast recipient when `payload.target.type` is `broadcast`.

## Consumer service

```bash
cd consumer
npm install
HOST=127.0.0.1 PORT=3002 TELEGRAM_BOT_TOKEN=your_bot_token npm run start:dev
```

By default the service starts on `http://127.0.0.1:3002`.

Available endpoints:

- `GET /health` - service health check
- `GET /metrics` - Prometheus metrics
- `GET /consumer` - consumer service metadata
- `GET /api/docs` - Swagger UI

To test real Telegram delivery:

1. Open your bot in Telegram and send `/start`.
2. Find your chat id without committing the token:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
```

3. Use that `chat.id` as `chatId` in the panel single-chat form.

The panel can also load known chats from the Consumer service. Telegram only
returns chats that already interacted with the bot, so each test user must send
`/start` to the bot first. Phone numbers are only available when a user shares a
contact with the bot.

Broadcast messages use the union of configured chat ids and known Telegram chats.
Telegram Bot API does not provide a global "all chats" endpoint; known chats are
derived from `getUpdates`, so each recipient must interact with the bot first.
For local testing you can also provide a comma-separated list:

```bash
HOST=127.0.0.1 TELEGRAM_BOT_TOKEN=your_bot_token TELEGRAM_BROADCAST_CHAT_IDS=123456789,987654321 npm run start:dev
```

## Current stage

The repository currently contains the Nest.js Producer service with RabbitMQ publishing, a Consumer service that reads notification events and sends Telegram messages, a Next.js notification panel, Docker Compose orchestration, and a Prometheus/Grafana observability stack for the full local system.
