import { DaprClient } from '@dapr/dapr';
import { DaprBinding, DaprPubSub } from '@dbc-tech/nest-dapr';
import { Controller, Get, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';

const pubSubName = 'my-pubsub';
const topicName = 'my-topic';
const bindingName = 'my-queue-binding';

interface Message {
  hello: string;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    readonly daprClient: DaprClient,
  ) {
    this.logger.log(`Dapr Client running on ${daprClient.options.daprPort}`);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('pubsub')
  async pubsub() {
    const message: Message = { hello: 'world' };

    return this.daprClient.pubsub.publish(pubSubName, topicName, message);
  }

  @DaprPubSub(pubSubName, topicName)
  pubSubHandler(message: Message): void {
    this.logger.log(`Received topic:${topicName} message:`, message);
  }

  @Post('binding')
  async binding(): Promise<object> {
    const bindingOperation = 'create';
    const message: Message = { hello: 'world' };

    return this.daprClient.binding.send(bindingName, bindingOperation, message);
  }

  @DaprBinding(bindingName)
  bindingHandler(message: Message): void {
    this.logger.log(`Received binding ${bindingName} message:`, message);
  }
}
