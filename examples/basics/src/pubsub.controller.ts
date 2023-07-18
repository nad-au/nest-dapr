import { DaprClient } from '@dapr/dapr';
import { DaprPubSub } from '@dbc-tech/nest-dapr';
import { Controller, Logger, Post } from '@nestjs/common';
import { Message } from './Message';

@Controller()
export class PubsubController {
  private readonly logger = new Logger(PubsubController.name);

  constructor(readonly daprClient: DaprClient) {
    this.logger.log(`Dapr Client running on ${daprClient.options.daprPort}`);
  }

  @Post('pubsub')
  async pubsub() {
    const message: Message = { hello: 'world' };

    return this.daprClient.pubsub.publish('redis-pubsub', 'topic1', message);
  }

  @DaprPubSub('redis-pubsub', 'topic1')
  pubSubHandler(message: Message): void {
    this.logger.log(`Received topic message:`, message);
  }
}
