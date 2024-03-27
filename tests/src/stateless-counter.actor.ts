import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprContextService, SerializableError } from '../../lib';
import { Inject } from '@nestjs/common';
import { DaprActorOnEvent } from '../../lib/dapr-actor-on-event.decorator';

export abstract class StatelessCounterActorInterface {
  abstract increment(): Promise<void>;
  abstract getCounter(): Promise<number>;
  abstract throwSerializableError(): Promise<void>;
  abstract throwError(): Promise<void>;
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

  async throwSerializableError(): Promise<void> {
    // This will result in HTTP 400
    throw new SerializableError('This is a serializable error', 400);
  }

  async throwError(): Promise<void> {
    // This will result in HTTP 500
    throw new Error('This is a non-serializable error');
  }
}
