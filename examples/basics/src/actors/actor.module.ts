import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CounterActor } from './counter.actor';
import { GlobalCounterActor } from './global.counter.actor';

export const Actors = [CounterActor, GlobalCounterActor];

@Module({
  imports: [CqrsModule],
  providers: [...Actors],
})
export class ActorModule {}
