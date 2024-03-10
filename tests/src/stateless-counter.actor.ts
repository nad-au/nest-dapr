import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprContextService } from '../../lib';
import { Inject } from '@nestjs/common';
import { DaprActorOnEvent } from '../../lib/dapr-actor-on-event.decorator';

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

  @DaprActorOnEvent('com.example.*', (payload: any) => payload.producerId)
  async increment(): Promise<void> {
    const existingContext = this.contextService.get<any>();

    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);
    this.counter++;
  }

  async getCounter(): Promise<number> {
    const existingContext = this.contextService.get<any>();

    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);
    return this.counter;
  }
}
