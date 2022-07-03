import { DaprClient } from '@dapr/dapr';
import { DaprBinding, DaprPubSub } from '@dbc-tech/nest-dapr';
import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

const pubSubName = 'my-pubsub';
const topicName = 'my-topic';
const bindingName = 'my-queue-binding';

interface Message {
  hello: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    readonly daprClient: DaprClient,
  ) {
    console.log(`Dapr Client running on ${daprClient.daprPort}`);
  }

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

  @Post('binding')
  async binding(): Promise<object> {
    const bindingOperation = 'create';
    const message: Message = { hello: 'world' };

    return this.daprClient.binding.send(bindingName, bindingOperation, message);
  }

  @DaprBinding(bindingName)
  bindingHandler(message: Message): void {
    console.log(`Received binding ${bindingName} message:`, message);
  }
}
