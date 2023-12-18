import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprContextService } from '../../lib';
import { Inject } from '@nestjs/common';

export abstract class StatelessCounterActorInterface {
  abstract increment(): Promise<void>;
  abstract getCounter(): Promise<number>;
}

@DaprActor({
  interfaceType: StatelessCounterActorInterface,
})
export class StatelessCounterActor extends AbstractActor implements StatelessCounterActorInterface {
  @Inject()
  private readonly contextService: DaprContextService;

  counter: number = 0;

  async increment(): Promise<void> {
    const context = this.contextService.get<any>();
    console.log('context', context);
    this.counter++;
  }

  async getCounter(): Promise<number> {
    const context = this.contextService.get<any>();
    console.log('context', context);
    return this.counter;
  }
}
