import { IState, StatefulActor } from '../../lib/actors/stateful.actor';
import { DaprActor, State } from '../../lib';
import { Inject } from '@nestjs/common';
import { CacheService } from './cache.service';

export abstract class CounterActorInterface {
  abstract increment(): Promise<void>;
  abstract getCounter(): Promise<number>;
}

export class CounterState implements IState {
  counter: number = 0;

  fromJSON(json: any) {
    this.counter = json.counter;
    return this;
  }

  toJSON(): any {
    return {
      counter: this.counter,
    };
  }
}

@DaprActor({
  interfaceType: CounterActorInterface,
})
export class CounterActor extends StatefulActor implements CounterActorInterface {
  @Inject(CacheService)
  private readonly cacheService: CacheService;

  @State({
    defaultValue: () => new CounterState(),
  })
  state: CounterState;

  async onActivate(): Promise<void> {
    return super.onActivate();
  }

  async increment(): Promise<void> {
    this.state.counter++;
    // Use a NestJS service as an example.
    // Share in memory state between actors on this node.
    await this.cacheService.increment('total');
    await this.saveState();
  }

  async getCounter(): Promise<number> {
    return this.state.counter;
  }
}
