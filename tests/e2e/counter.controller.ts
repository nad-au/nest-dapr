import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CounterActorInterface } from '../src/counter.actor';
import { DaprActorClient } from '../../lib/actors/dapr-actor-client.service';

@Controller('counter')
export class CounterController {
  constructor(private readonly actorClient: DaprActorClient) {}

  @Post(':id/increment')
  @HttpCode(204)
  increment(@Param('id') id: string): Promise<void> {
    return this.actorClient.getActor(CounterActorInterface, id).increment();
  }

  @Get(':id')
  @HttpCode(200)
  get(@Param('id') id: string): Promise<number> {
    return this.actorClient.getActor(CounterActorInterface, id).getCounter();
  }
}
