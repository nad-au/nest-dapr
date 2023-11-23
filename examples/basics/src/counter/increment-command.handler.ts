import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { IncrementCounterCommand } from './increment-counter.command';
import { DaprActorClient } from '@jeremycarter/nest-dapr';
import { CounterActorInterface } from '../counter.actor';
import { CounterIncrementedEvent } from './counter-incremented.event';
import { Logger } from '@nestjs/common';

@CommandHandler(IncrementCounterCommand)
export class IncrementCommandHandler
  implements ICommandHandler<IncrementCounterCommand, number>
{
  private readonly logger = new Logger(IncrementCommandHandler.name);
  constructor(
    private readonly eventBus: EventBus,
    private readonly actorClient: DaprActorClient,
  ) {}

  async execute(command: IncrementCounterCommand): Promise<number> {
    const value = await this.actorClient
      .getActor(CounterActorInterface, command.id)
      .increment();
    this.logger.log(`IncrementCommand: ${command.id} ${value}`);
    this.eventBus.publish(new CounterIncrementedEvent(command.id, value));
    return value;
  }
}
