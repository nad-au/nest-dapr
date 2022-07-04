# Basics: nest-dapr example

Demonstrates pubsub & input bindings using RabbitMQ.

## Getting Started

Install packages

```bash
npm i
```

Start docker-compose to launch RabbitMQ container

```bash
docker-compose up
```

Launch app with Dapr sidecar

```bash
npm run start:dapr
```

## pubsub test

Invoke endpoint to publish message

```bash
curl -X POST localhost:3000/pubsub
```

Observe handler received message

## Input binding test

Invoke endpoint to send output binding message

```bash
curl -X POST localhost:3000/binding
```

Observe handler received message
