import { AbstractActor } from '@dapr/dapr';
import { DaprActor } from '../../lib';

export abstract class StatelessCounterActorInterface {
  abstract increment(): Promise<void>;
  abstract getCounter(): Promise<number>;
}

@DaprActor({
  interfaceType: StatelessCounterActorInterface,
})
export class StatelessCounterActor
  extends AbstractActor
  implements StatelessCounterActorInterface
{
  counter: number = 0;

  async increment(): Promise<void> {
    this.counter++;
  }

  async getCounter(): Promise<number> {
    return this.counter;
  }
}
