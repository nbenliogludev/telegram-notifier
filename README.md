# telegram-notifier

Microservice-based Telegram notification system.

## Services

- `producer` - Nest.js Producer service scaffold. This service will be responsible for accepting events and publishing them to RabbitMQ in the next implementation stage.

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

Available endpoints:

- `GET /health` - service health check
- `POST /producer/events` - publish an event to RabbitMQ
- `GET /api/docs` - Swagger UI

## Current stage

The repository currently contains the Nest.js Producer service with RabbitMQ publishing. Consumer service, Telegram Bot API integration, full Docker deployment, and broader test coverage are planned for the following stages.
