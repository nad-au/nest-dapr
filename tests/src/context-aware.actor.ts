import { AbstractActor } from '@dapr/dapr';
import { DaprActor, DaprActorClient, DaprContextService } from '../../lib';
import { Inject } from '@nestjs/common';
import { StatelessCounterActorInterface } from './stateless-counter.actor';

export abstract class ContextAwareActorInterface {
  abstract run(): Promise<string>;
  abstract ping(): Promise<string>;
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

    const nested = this.client.getActor(ContextAwareActorInterface, 'nested-context-2');
    await nested.ping();

    const counter = this.client.getActor(StatelessCounterActorInterface, 'counter-1');
    const previousValue = await counter.getCounter();

    // Increment 3 times
    await counter.increment();
    await counter.increment();
    await counter.increment();

    const value = await counter.getCounter();
    console.log('counter', value);

    expect(value).toBe(previousValue + 3);

    return existingContext?.correlationID;
  }

  async ping(): Promise<string> {
    const existingContext = this.contextService.get<any>();

    console.log('existingContext', existingContext);
    console.log('correlationID', existingContext?.correlationID);

    return existingContext?.correlationID;
  }
}
