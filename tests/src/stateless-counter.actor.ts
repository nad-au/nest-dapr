import { AbstractActor } from '@dapr/dapr';
import { DaprActor } from '../../lib';

export abstract class StatelessCounterActorInterface {
  abstract increment(context?: any): Promise<void>;
  abstract getCounter(context?: any): Promise<number>;
}

@DaprActor({
  interfaceType: StatelessCounterActorInterface,
})
export class StatelessCounterActor
  extends AbstractActor
  implements StatelessCounterActorInterface
{
  counter: number = 0;

  async increment(context?: any): Promise<void> {
    console.log('context', context);
    this.counter++;
  }

  async getCounter(context?: any): Promise<number> {
    console.log('context', context);
    return this.counter;
  }
}
