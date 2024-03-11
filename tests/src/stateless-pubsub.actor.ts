import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprContextService } from '../../lib';
import { Inject } from '@nestjs/common';
import { DaprActorOnEvent } from '../../lib/dapr-actor-on-event.decorator';

export abstract class StatelessPubSubActorInterface {
  abstract increment(payload?: any): Promise<void>;
  abstract getMessages(): Promise<any[]>;
  abstract handleEvent(payload?: PubSubEvent): Promise<void>;
}

export class PubSubEvent {
  type: string;
  producerId: string;
  id: string;
  otherIds: string[];
  time: string;
  run: string;
}

@DaprActor({
  interfaceType: StatelessPubSubActorInterface,
})
export class StatelessPubSubActor extends AbstractActor implements StatelessPubSubActorInterface {
  @Inject()
  private readonly contextService: DaprContextService;

  counter: number = 0;
  messages: any[] = [];

  @DaprActorOnEvent('com.example.event', (payload: any) => payload.producerId)
  async increment(payload?: any): Promise<void> {
    this.messages.push(payload);
    console.log('payload', payload);

    const existingContext = this.contextService.get<any>();

    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);
    this.counter++;
  }

  @DaprActorOnEvent<PubSubEvent>('com.example.event', (payload) => payload.producerId)
  @DaprActorOnEvent<PubSubEvent>('com.example.*', (payload) => payload.otherIds)
  async handleEvent(payload?: PubSubEvent): Promise<void> {
    this.messages.push(payload);
    console.log('payload', payload);
  }

  async getMessages(): Promise<any[]> {
    const existingContext = this.contextService.get<any>();
    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);
    return this.messages;
  }
}
