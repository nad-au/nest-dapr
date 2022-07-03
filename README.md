Develop NestJs microservices using [Dapr](https://dapr.io/) pubsub and bindings

# Description

Dapr Module for [Nest](https://github.com/nestjs/nest) built on top of the [Dapr JS SDK](https://github.com/dapr/js-sdk)

# Installation

```bash
npm i --save @dbc-tech/nest-dapr
```

# Requirements

Install [Dapr](https://dapr.io/) as per getting started [guide](https://docs.dapr.io/getting-started/). Ensure Dapr is running with:

```bash
dapr --version
```

Output:

```
CLI version: 1.7.1
Runtime version: 1.7.4
```

# Quick start

The following scaffolds a [Nest](https://github.com/nestjs/nest) project with the Nest-Dapr Module and demonstrates using Nest with Dapr using [RabbitMQ](https://www.rabbitmq.com/) pubsub & queue bindings.

Install Nest [CLI](https://docs.nestjs.com/cli/overview):

```bash
npm install -g @nestjs/cli
```

Scaffold Nest project

```
nest new nest-dapr
cd nest-dapr/
```

Install [nest-dapr](https://www.npmjs.com/package/@dbc-tech/nest-dapr)

```bash
npm i --save @dbc-tech/nest-dapr
```

Import `DaprModule` in `AppModule` class

```typescript
@Module({
  imports: [DaprModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Import `DaprClient` from `@dapr/dapr` package and add dependency to `AppController` class

```typescript
import { DaprClient } from '@dapr/dapr';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly daprClient: DaprClient,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

Create pubsub & topic names used for pubsub operations and message interface.

```typescript
const pubSubName = 'my-pubsub';
const topicName = 'my-topic';

interface Message {
  hello: string;
}

@Controller()
```

Create endpoint to publish topic message

```typescript
@Post('pubsub')
async pubsub(): Promise<boolean> {
  const message: Message = { hello: 'world' };

  return this.daprClient.pubsub.publish(pubSubName, topicName, message);
}
```

Create pubsub handler which will subscribe to the topic and log the received message

```typescript
@DaprPubSub(pubSubName, topicName)
pubSubHandler(message: Message): void {
  console.log(`Received topic:${topicName} message:`, message);
}
```

Create Dapr [pubsub](https://docs.dapr.io/developing-applications/building-blocks/pubsub/) component in `components` folder:

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: my-pubsub
  namespace: default
spec:
  type: pubsub.rabbitmq
  version: v1
  metadata:
  - name: host
    value: amqp://guest:guest@localhost:5674
```
Save file as `components/rabbitmq-pubsub.yaml`.

Create `docker-compose.yml` in the project root used to run [RabbitMQ](https://www.rabbitmq.com/)

```yaml
version: '3.9'
services:
  pubsub:
    image: rabbitmq:3-management-alpine
    ports:
      - 5674:5672
      - 15674:15672
```

Start RabbitMQ

```bash
docker-compose up
```

Create script to bootstrap your Nest project using Dapr sidecar. Update `package.json` and add script

```json
"scripts": {
  ..
  "start:dapr": "dapr run --app-id nest-dapr --app-protocol http --app-port 50001 --dapr-http-port 50000 --components-path ./components npm run start"
},
```

Start Nest app with Dapr

```bash
npm run start:dapr
```

Invoke endpoint to publish the message

```bash
curl -X POST localhost:3000/pubsub
```

This should publish a message to RabbitMQ which should be consumed by the handler and written to the console

```
== APP == Received topic:my-topic message: { hello: 'world' }
```

Full example

```typescript
import { DaprClient } from '@dapr/dapr';
import { DaprPubSub } from '@dbc-tech/nest-dapr';
import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

const pubSubName = 'my-pubsub';
const topicName = 'my-topic';

interface Message {
  hello: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly daprClient: DaprClient,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('pubsub')
  async pubsub(): Promise<boolean> {
    const message: Message = { hello: 'world' };

    return this.daprClient.pubsub.publish(pubSubName, topicName, message);
  }

  @DaprPubSub(pubSubName, topicName)
  pubSubHandler(message: Message): void {
    console.log(`Received topic:${topicName} message:`, message);
  }
}
```