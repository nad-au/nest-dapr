# Basics: nest-dapr example

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

Invoke endpoint to publish message

```bash
curl -X POST localhost:3000/pubsub
```

Observe handler received message
