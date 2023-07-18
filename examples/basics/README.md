# Basics: nest-dapr pubsub example

Demonstrates pubsub using Redis.

## Getting Started

Install packages

```bash
npm i
```

Start docker-compose to app & dapr

```bash
docker compose up
```

## pubsub test

Invoke endpoint to publish message

```bash
curl -X POST localhost:3000/pubsub
```

Observe handler received message

## Resiliency

Un-comment the `BadRequestException` throw to simulate handler failure

Observe retries defined in the resilience policy
