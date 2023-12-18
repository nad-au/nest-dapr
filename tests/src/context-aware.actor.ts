import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprActorClient, DaprContextService } from '../../lib';
import { Inject } from '@nestjs/common';
import { StatelessCounterActorInterface } from './stateless-counter.actor';

export abstract class ContextAwareActorInterface {
  abstract run(): Promise<string>;
}

@DaprActor({
  interfaceType: ContextAwareActorInterface,
})
export class ContextAwareActor extends AbstractActor implements ContextAwareActorInterface {
  @Inject()
  private readonly client: DaprActorClient;

  @Inject()
  private readonly contextService: DaprContextService;

  async run(): Promise<string> {
    const existingContext = this.contextService.get<any>();

    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);

    const counter = this.client.getActor(StatelessCounterActorInterface, 'counter-1');

    await counter.increment();
    const value = await counter.getCounter();
    console.log('counter', value);

    return existingContext?.correlationID;
  }
}
