import { StatefulActor } from './stateful.actor';

export class StatefulActorOf<TState> extends StatefulActor {
  state: TState;

  async saveStateObject(): Promise<void> {
    await this.setState<TState>('state', this.state);
    await this.getStateManager().saveState();
  }

  async getStateObject(): Promise<TState> {
    return await this.getState<TState>('state');
  }
}
