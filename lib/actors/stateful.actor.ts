import { AbstractActor } from '@dapr/dapr';
import { DAPR_ACTOR_STATE_METADATA } from '../constants';
import { StateProperty } from '../dapr-actor-state.decorator';

export interface IState {
  fromJSON(json: any): void;
  toJSON(): any;
}

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
    this.stateProperties = (Reflect.getMetadata(DAPR_ACTOR_STATE_METADATA, this.constructor) as StateProperty[]) || [];
    await super.onActivate();
    await this.getAllState();
  }

  async getAllState() {
    for (const property of this.stateProperties) {
      const rawValue = await this.getState(property.name);
      if (rawValue === undefined) {
        if (typeof property.defaultValue === 'function') {
          this[property.key] = property.defaultValue();
        } else {
          this[property.key] = property.defaultValue;
        }
      } else {
        // We have obtained the raw value from the state store, but we need to convert it to the correct type
        // Lets see if the type has a `fromJSON` and a `toJSON` method
        if (property.serializable) {
          // New up a new instance of the type and call the `fromJSON` method
          let instance: IState = this.createInstance(property.type);
          if (!instance && typeof property.defaultValue === 'function') {
            instance = property.defaultValue();
          }
          instance.fromJSON(rawValue);
          this[property.key] = instance;
        } else {
          this[property.key] = rawValue;
        }
      }
    }
  }

  async setAllStateFromProperties() {
    for (const property of this.stateProperties) {
      let value = this[property.key];
      // If the property is serializable, then we need to call the `toJSON` method
      if (property.serializable) {
        const instance = value as IState;
        value = instance.toJSON();
      }
      await this.setState(property.name, value);
    }
  }

  async getState<T>(stateName: string, defaultValue: T = undefined): Promise<T | undefined> {
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

  private createInstance<T>(type: Constructor<T> | { new (): T } | any): T {
    return new type();
  }
}

type Constructor<T = any> = new (...args: any[]) => T;
