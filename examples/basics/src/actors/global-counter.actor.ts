import { DaprActor, StatefulActor } from '@rayondigital/nest-dapr';
import { Logger } from '@nestjs/common';
import { GlobalCounterActorInterface } from './global-counter.actor.interface';

@DaprActor({
  interfaceType: GlobalCounterActorInterface,
})
export class GlobalCounterActor
  extends StatefulActor
  implements GlobalCounterActorInterface
{
  private readonly log = new Logger(GlobalCounterActor.name);

  counter: number;

  async onActivate(): Promise<void> {
    this.counter = await this.getState('counter', 0);
    this.logInfo(`onActivateGlobal: ${this.getActorId()}`);
    return super.onActivate();
  }

  async increment(): Promise<number> {
    this.counter++;
    this.logInfo(`incrementGlobal: ${this.counter}`);
    await this.setState('counter', this.counter);
    await this.saveState();
    return this.counter;
  }

  async getCounter(): Promise<number> {
    this.logInfo(`getGlobalCounter: ${this.getActorId()} ${this.counter}`);
    const counter = await this.getState('counter', 0);
    this.counter = counter;
    return counter;
  }

  private logInfo(message: string | any) {
    this.log.log(`[${process.env.HOSTNAME || 'localhost'}] ${message}`);
  }
}
