import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CounterIncrementedEvent } from './counter-incremented.event';
import { Logger } from '@nestjs/common';

@EventsHandler(CounterIncrementedEvent)
export class IncrementedEventHandler
  implements IEventHandler<CounterIncrementedEvent>
{
  private readonly logger = new Logger(IncrementedEventHandler.name);
  handle(event: CounterIncrementedEvent) {
    this.logger.log(`IncrementedEvent: ${event.id} ${event.value}`);
  }
}
