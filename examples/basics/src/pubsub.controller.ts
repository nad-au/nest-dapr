import { DaprClient } from '@dapr/dapr';
import { BadRequestException, Controller, Logger, Post } from '@nestjs/common';
import { Message } from './Message';
import { DaprPubSub } from '@dbc-tech/nest-dapr';

@Controller()
export class PubsubController {
  private readonly logger = new Logger(PubsubController.name);

  constructor(readonly daprClient: DaprClient) {
    this.logger.log(`Dapr Client running on ${daprClient.options.daprPort}`);
  }

  @Post('pubsub')
  async pubsub() {
    const message: Message = { hello: Date.now().toString(36) };

    return this.daprClient.pubsub.publish('redis-pubsub', 'myqueue', message);
  }

  @DaprPubSub('redis-pubsub', 'myqueue')
  pubSubHandler(message: Message): void {
    this.logger.log(`Received topic message:`, message);
    //throw new BadRequestException();
  }
}
