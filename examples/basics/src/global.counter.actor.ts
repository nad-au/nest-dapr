import { DaprActor, StatefulActor } from '@jeremycarter/nest-dapr';
import { Logger } from '@nestjs/common';

export abstract class GlobalCounterActorInterface {
  abstract increment(): Promise<void>;
  abstract getCounter(): Promise<number>;
}

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

  async increment(): Promise<void> {
    this.counter++;
    this.logInfo(`incrementGlobal: ${this.counter}`);
    await this.setState('counter', this.counter);
    await this.saveState();
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
