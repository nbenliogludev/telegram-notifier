# telegram-notifier

Microservice-based Telegram notification system.

## Services

- `producer` - Nest.js Producer service scaffold. This service will be responsible for accepting events and publishing them to RabbitMQ in the next implementation stage.

## Producer service

```bash
cd producer
npm install
npm run start:dev
```

By default the service starts on `http://localhost:3000`.

Available endpoints:

- `GET /health` - service health check
- `GET /api/docs` - Swagger UI

## Current stage

The repository currently contains the initialized Nest.js Producer service only. RabbitMQ publishing, Consumer service, Telegram Bot API integration, Docker deployment, and full test coverage are planned for the following stages.
