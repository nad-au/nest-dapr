import { AbstractActor } from '@dapr/dapr';

export class StatefulActor extends AbstractActor {
  async setState<T>(stateName: string, value: T): Promise<void> {
    await this.getStateManager<T>().setState(stateName, value);
  }

  async removeState(stateName: string): Promise<void> {
    await this.getStateManager().removeState(stateName);
  }

  async saveState(): Promise<void> {
    await this.getStateManager().saveState();
  }

  async getState<T>(
    stateName: string,
    defaultValue: T = undefined,
  ): Promise<T | undefined> {
    try {
      const value = await this.getStateManager<T>().getState(stateName);
      if (value === undefined) {
        return defaultValue;
      }
      return value;
    } catch (e) {
      // Before we return the value, lets just check that there is no existing entry
      const exists = await this.getStateManager().containsState(stateName);
      if (!exists) {
        return defaultValue;
      }
      // There is an existing item that we are unable to obtain
      throw e;
    }
  }
}
