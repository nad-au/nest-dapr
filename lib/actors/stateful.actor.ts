import { AbstractActor } from '@dapr/dapr';
import { DAPR_ACTOR_STATE_METADATA } from '../constants';
import { StateProperty } from '../dapr-actor-state.decorator';

export interface IState {
  fromJSON(json: any): this;
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this[property.key] = property.defaultValue();
        } else if (property.defaultValue !== undefined) {
          this[property.key] = property.defaultValue;
        } else {
          // Attempt to new up a new instance of the type (call the constructor)
          this[property.key] = this.createStatePropertyInstance(property);
        }
      } else {
        // We have obtained the raw value from the state store, but we need to convert it to the correct type
        // Lets see if the type has a `fromJSON` and a `toJSON` method
        if (property.serializable) {
          // Assume that the type has a `fromJSON` and a `toJSON` methods (loose typing)
          // New up a new instance of the type (call the constructor)
          // Assuming that the type has a default constructor
          const instance: IState = this.createStatePropertyInstance(property);
          this[property.key] = instance.fromJSON(rawValue) ?? instance;
        } else {
          this[property.key] = rawValue;
        }
      }
    }
  }

  async setAllStateFromProperties() {
    // Iterate over all @State properties and set their inner state manager values
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

  private createStatePropertyInstance<T>(property: StateProperty): T {
    try {
      if (property.defaultValue !== undefined) {
        if (property.defaultValue instanceof Function || typeof property.defaultValue === 'function') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return property.defaultValue();
        }
        return property.defaultValue;
      }
      if (property.type || property.serializable) {
        const type: Constructor<T> | { new (): T } | any = property.type;
        return new type();
      }
    } catch (e) {
      // If we get an error, then it is likely that the type does not have a default constructor
      // Or cannot be newed up using the `new` keyword, so lets just return undefined
      return undefined;
    }
  }
}

type Constructor<T = any> = new (...args: any[]) => T;
