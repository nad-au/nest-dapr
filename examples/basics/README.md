# Basics: nest-dapr example

Demonstrates Dapr integration with NestJS

## Getting Started

Install packages

```bash
npm i
```

## Dapr Setup

Ensure Dapr Cli is installed. See https://docs.dapr.io/getting-started/install-dapr-cli/
```bash
winget install Dapr.CLI
brew install dapr/tap/dapr-cli
```

You can use Dapr locally or Docker compose using 
```bash
dapr init
```

To use docker compose & Dapr

```bash
docker compose up
```

## Run the application

The ports are:

| Service | Port |
| --- | --- |
| NestJS | 3000 |
| Dapr | 3001 |
| Dapr Sidecar | 3500 |

```bash
dapr run --app-id basics --app-protocol http --app-port 3001 --dapr-http-port 3500 npm run start
```

## PubSub test

Invoke endpoint to publish message

```bash
curl -X POST localhost:3000/pubsub
```

Observe handler received message

## Resiliency

Un-comment the `BadRequestException` throw to simulate handler failure

Observe retries defined in the resilience policy


## Actor test

Invoke the counter endpoint to increment the counter

```bash
curl -X POST localhost:3000/counter/counter-1/increment
```

Observe the counter value

```bash
curl localhost:3000/counter/counter-1
```

Observer the global counter value

```bash
curl localhost:3000/counter/global
```