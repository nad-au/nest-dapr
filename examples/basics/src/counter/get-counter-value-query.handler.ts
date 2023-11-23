import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCounterValueQuery } from './get-counter-value.query';
import { DaprActorClient } from '@rayondigital/nest-dapr';
import { GlobalCounterActorInterface } from '../actors/global-counter.actor.interface';
import { CounterActorInterface } from '../actors/counter.actor.interface';

@QueryHandler(GetCounterValueQuery)
export class GetCounterValueQueryHandler
  implements IQueryHandler<GetCounterValueQuery, number>
{
  constructor(private readonly actorClient: DaprActorClient) {}

  async execute(query: GetCounterValueQuery): Promise<number> {
    if (query.id === 'global') {
      return this.actorClient
        .getActor(GlobalCounterActorInterface, 'global')
        .getCounter();
    } else {
      return await this.actorClient
        .getActor(CounterActorInterface, query.id)
        .getCounter();
    }
  }
}
