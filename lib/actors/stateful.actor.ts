import { DAPR_ACTOR_STATE_METADATA } from '../constants';
import { StateProperty } from '../dapr-actor-state.decorator';
import { AbstractActor } from './abstract-actor';

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
          this[property.key] = property.defaultValue();
        } else if (property.defaultValue !== undefined) {
          this[property.key] = property.defaultValue;
        } else {
          // Attempt to new up a new instance of the type (call the constructor)
          this[property.key] = this.createInstance(property.type);
        }
      } else {
        // We have obtained the raw value from the state store, but we need to convert it to the correct type
        // Lets see if the type has a `fromJSON` and a `toJSON` method
        const instance = this.createInstanceFromProperty(property, rawValue);
        if (instance !== undefined) {
          this[property.key] = instance;
        } else {
          // The user may think this is typed, but its just the raw value
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
      if (value !== undefined && property.serializable) {
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

  private createInstanceFromProperty(property: StateProperty, rawValue?: any) {
    // This method is a little complex, but we're trying to be a nice to the end user as possible
    try {
      if (property.serializable) {
        let instance: IState;
        if (typeof property.defaultValue === 'function') {
          instance = property.defaultValue();
        } else {
          // New up a new instance of the type (call the constructor)
          // Assuming that the type has a default constructor
          instance = this.createInstance(property.type);
        }
        if (instance.fromJSON) {
          this[property.key] = instance.fromJSON(rawValue) ?? instance;
        } else {
          this[property.key] = instance;
          // For each of the raw values properties, set the instance property of the same name
          for (const key of Object.keys(rawValue)) {
            instance[key] = rawValue[key];
          }
        }
      } else {
        // We don't know if the type is serializable, so lets just try to new up an instance
        // This is the safest default the user is likely to want.
        let instance: any;
        if (typeof property.defaultValue === 'function') {
          instance = property.defaultValue();
        } else if (property.type) {
          // New up a new instance of the type (call the constructor)
          // Assuming that the type has a default constructor
          instance = this.createInstance(property.type);
        }
        if (instance !== undefined) {
          // For each of the raw values properties, set the instance property of the same name
          for (const key of Object.keys(rawValue)) {
            instance[key] = rawValue[key];
          }
          return instance;
        }
      }
    } catch (e) {
      return undefined;
    }
  }

  private createInstance<T>(type: Constructor<T> | { new (): T } | any): T {
    try {
      return new type();
    } catch (e) {
      // If we get an error, then it is likely that the type does not have a default constructor
      // Or cannot be newed up using the `new` keyword, so lets just return undefined
      return undefined;
    }
  }
}

type Constructor<T = any> = new (...args: any[]) => T;
