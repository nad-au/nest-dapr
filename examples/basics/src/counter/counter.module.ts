import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IncrementCommandHandler } from './increment-command.handler';
import { IncrementedEventHandler } from './incremented-event.handler';
import { GetCounterValueQueryHandler } from './get-counter-value-query.handler';
import { ExternalCommandHandler } from './external-command';

export const CommandHandlers = [
  IncrementCommandHandler,
  ExternalCommandHandler,
];
export const QueryHandlers = [GetCounterValueQueryHandler];
export const EventHandlers = [IncrementedEventHandler];

@Module({
  imports: [CqrsModule],
  providers: [...CommandHandlers, ...QueryHandlers, ...EventHandlers],
})
export class CounterModule {}
