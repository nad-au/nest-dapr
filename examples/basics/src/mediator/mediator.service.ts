import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Mediator {
  constructor(private commandBus: CommandBus, private queryBus: QueryBus) {}

  async execute<T, TResult = any>(command: T): Promise<TResult> {
    return await this.commandBus.execute(command);
  }

  async query<T, TResult = any>(query: T): Promise<TResult> {
    return await this.queryBus.execute(query);
  }
}
