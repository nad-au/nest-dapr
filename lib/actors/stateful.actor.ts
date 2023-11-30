import { AbstractActor } from '@dapr/dapr';
import { DAPR_ACTOR_STATE } from '../constants';
import { StateProperty } from '../dapr-actor-state.decorator';

export class StatefulActor extends AbstractActor {
  private stateProperties: StateProperty[];

  async setState<T>(stateName: string, value: T): Promise<void> {
    await this.getStateManager<T>().setState(stateName, value);
  }

  async removeState(stateName: string): Promise<void> {
    await this.getStateManager().removeState(stateName);
  }

  async saveState(): Promise<void> {
    await this.setAllStateFromProperties();
    await this.getStateManager().saveState();
  }

  async clearState(): Promise<void> {
    for (const property of this.stateProperties) {
      await this.removeState(property.name);
    }
  }

  async onActivate(): Promise<void> {
    this.stateProperties =
      (Reflect.getMetadata(
        DAPR_ACTOR_STATE,
        this.constructor,
      ) as StateProperty[]) || [];
    await super.onActivate();
    await this.getAllState();
  }

  async getAllState() {
    for (const property of this.stateProperties) {
      const value = await this.getState(property.name);
      if (value === undefined) {
        if (typeof property.defaultValue === 'function') {
          this[property.key] = property.defaultValue();
        } else {
          this[property.key] = property.defaultValue;
        }
      } else {
        this[property.key] = value;
      }
    }
  }

  async setAllStateFromProperties() {
    for (const property of this.stateProperties) {
      await this.setState(property.name, this[property.key]);
    }
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
