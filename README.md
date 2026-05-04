# telegram-notifier

Microservice-based Telegram notification system.

## Services

- `producer` - Nest.js Producer service scaffold. This service will be responsible for accepting events and publishing them to RabbitMQ in the next implementation stage.
- `panel` - Next.js test panel for sending Telegram notification events to the Producer API.

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
npm run start:dev
```

By default the service starts on `http://localhost:3000`.

## Notification panel

```bash
cd panel
npm install
npm run build
npm run start
```

By default the panel starts on `http://localhost:3001` and proxies requests to `http://127.0.0.1:3000`.

Available endpoints:

- `GET /health` - service health check
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

Use `targetType: "broadcast"` when the future Consumer should fan out the message to all known subscribers:

```json
{
  "targetType": "broadcast",
  "message": "System maintenance starts at 21:00",
  "metadata": {
    "source": "admin-panel"
  }
}
```

Both requests publish the RabbitMQ event type `telegram.notification.requested`. The Consumer should read the event envelope and send `payload.message.text` to either `payload.target.chatId` or every stored subscriber when `payload.target.type` is `broadcast`.

## Current stage

The repository currently contains the Nest.js Producer service with RabbitMQ publishing. Consumer service, Telegram Bot API integration, full Docker deployment, and broader test coverage are planned for the following stages.
