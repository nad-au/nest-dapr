import {
  DaprActor,
  DaprActorClient,
  StatefulActor,
} from '@jeremycarter/nest-dapr';
import { Inject, Logger } from '@nestjs/common';
import { GlobalCounterActorInterface } from './global.counter.actor';
import { Mediator } from './mediator.service';
import { ExternalCommand } from './counter/external-command';

export abstract class CounterActorInterface {
  abstract increment(): Promise<number>;
  abstract getCounter(): Promise<number>;
}

@DaprActor({
  interfaceType: CounterActorInterface,
})
export class CounterActor
  extends StatefulActor
  implements CounterActorInterface
{
  private readonly log = new Logger(CounterActor.name);

  @Inject()
  private readonly client: DaprActorClient;
  @Inject()
  private readonly mediator: Mediator;

  counter: number;

  async onActivate(): Promise<void> {
    this.counter = await this.getState('counter', 0);
    this.logInfo(`onActivate: ${this.getActorId()}`);
    return super.onActivate();
  }

  async increment(): Promise<number> {
    this.counter++;
    this.logInfo(`increment: ${this.getActorId()}`);
    await this.setState('counter', this.counter);
    await this.saveState();

    // Call the database
    const db = await this.mediator.execute(
      new ExternalCommand(this.getActorId().toString()),
    );
    this.logInfo(`dbId: ${JSON.stringify(db)}`);

    // Call the global counter actor.
    await this.client
      .getActor(GlobalCounterActorInterface, 'global')
      .increment();

    return this.counter;
  }

  async getCounter(): Promise<number> {
    this.logInfo(`getCounter: ${this.getActorId()} ${this.counter}`);
    const counter = await this.getState('counter', 0);
    this.counter = counter;
    return counter;
  }

  private logInfo(message: string | any) {
    this.log.log(`[${process.env.HOSTNAME || 'localhost'}] ${message}`);
  }
}
