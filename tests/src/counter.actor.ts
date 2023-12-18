import { StatefulActor } from '../../lib/actors/stateful.actor';
import { DaprActor } from '../../lib';
import { Inject } from '@nestjs/common';
import { CacheService } from './cache.service';

export abstract class CounterActorInterface {
  abstract increment(context?: any): Promise<void>;
  abstract getCounter(context?: any): Promise<number>;
}

@DaprActor({
  interfaceType: CounterActorInterface,
})
export class CounterActor
  extends StatefulActor
  implements CounterActorInterface
{
  @Inject(CacheService)
  private readonly cacheService: CacheService;

  counter: number;

  async onActivate(): Promise<void> {
    this.counter = 0;
    return super.onActivate();
  }

  async increment(context?: any): Promise<void> {
    console.log('context', context);
    this.counter++;
    // Use a NestJS service as an example.
    // Share in memory state between actors on this node.
    await this.cacheService.increment('total');

    await this.setState('counter', this.counter);
    await this.saveState();
  }

  async getCounter(context?: any): Promise<number> {
    console.log('context', context);
    const counter = await this.getState('counter', 0);
    this.counter = counter;
    return counter;
  }
}
