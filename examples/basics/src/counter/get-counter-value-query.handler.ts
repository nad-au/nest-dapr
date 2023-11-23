import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCounterValueQuery } from './get-counter-value.query';
import { DaprActorClient } from '@jeremycarter/nest-dapr';
import { CounterActorInterface } from '../counter.actor';
import { GlobalCounterActorInterface } from '../global.counter.actor';

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
