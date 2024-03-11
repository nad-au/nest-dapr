import { Inject, Logger } from '@nestjs/common';
import { DAPR_ACTOR_STATE_METADATA } from '../constants';
import { StateProperty } from '../dapr-actor-state.decorator';
import { DaprContextService } from '../dapr-context-service';
import { AbstractActor } from './abstract-actor';
import { DaprActorClient } from './dapr-actor-client.service';
import { ActorId, DaprClient } from '@dapr/dapr';

export interface IState {
  fromJSON(json: any): this;
  toJSON(): any;
}

export class StatefulActor extends AbstractActor {
  private statePropertiesInternal: StateProperty[];

  @Inject()
  protected readonly client: DaprActorClient;
  @Inject()
  protected readonly contextService: DaprContextService;

  protected logger: Logger;

  constructor(daprClient: DaprClient, id: ActorId) {
    super(daprClient, id);
    this.logger = new Logger(this.constructor.name);
  }

  async onActivate(): Promise<void> {
    this.statePropertiesInternal =
      (Reflect.getMetadata(DAPR_ACTOR_STATE_METADATA, this.constructor) as StateProperty[]) || [];
    await super.onActivate();
    await this.getAllState();
  }

  protected logMessage(message: any, level: 'log' | 'error' | 'warn' | 'debug' = 'log') {
    switch (level) {
      case 'log':
        this.logger.log(message, this.constructor.name);
        break;
      case 'error': {
        const stack = message.stack ?? new Error().stack;
        this.logger.error(message, stack, this.constructor.name);
        break;
      }
      case 'warn':
        this.logger.warn(message, this.constructor.name);
        break;
      case 'debug':
        this.logger.debug(message, this.constructor.name);
        break;
    }
  }

  protected log(message: any, ...optionalParams: [...any, string?]) {
    this.logger.log(message, ...optionalParams);
  }

  protected verbose(message: any, ...optionalParams: [...any, string?]) {
    this.logger.verbose(message, ...optionalParams);
  }

  protected warn(message: any, ...optionalParams: [...any, string?]) {
    this.logger.warn(message, ...optionalParams);
  }

  protected async setStateValue<T>(stateName: string, value: T): Promise<void> {
    await this.getStateManager<T>().setState(stateName, value);
  }

  protected async removeStateValue(stateName: string): Promise<void> {
    await this.getStateManager().removeState(stateName);
  }

  protected async saveState(): Promise<void> {
    await this.setAllStateFromPropertiesInternal();
    await this.getStateManager().saveState();
  }

  protected async clearState(): Promise<void> {
    for (const property of this.statePropertiesInternal) {
      await this.removeStateValue(property.name);
    }
  }

  protected async getAllState() {
    for (const property of this.statePropertiesInternal) {
      await this.loadStatePropertyInternal(property);
    }
  }

  private async loadStatePropertyInternal(property: StateProperty) {
    const rawValue = await this.getStateValue(property.name);
    if (rawValue === undefined) {
      if (typeof property.defaultValue === 'function') {
        (this as any)[property.key] = property.defaultValue();
      } else if (property.defaultValue !== undefined) {
        (this as any)[property.key] = property.defaultValue;
      } else {
        // Attempt to new up a new instance of the type (call the constructor)
        (this as any)[property.key] = createInstanceOfType(property.type);
      }
    } else {
      // We have obtained the raw value from the state store, but we need to convert it to the correct type
      // Lets see if the type has a `fromJSON` and a `toJSON` method
      const instance = createInstanceFromProperty(property, rawValue);
      if (instance !== undefined) {
        (this as any)[property.key] = instance;
      } else {
        // The user may think this is typed, but its just the raw value
        (this as any)[property.key] = rawValue;
      }
    }
  }

  private async setAllStateFromPropertiesInternal() {
    // Iterate over all @State properties and set their inner state manager values
    for (const property of this.statePropertiesInternal) {
      let value = (this as any)[property.key];
      // If the property is serializable, then we need to call the `toJSON` method
      // If the toJSON method fails, then an error will be thrown and the state will not be set
      if (value !== undefined && property.serializable) {
        const instance = value as IState;
        // Only convert to JSON if the instance has a `toJSON` method
        if (typeof instance.toJSON === 'function') {
          value = instance?.toJSON();
        }
      }
      await this.setStateValue(property.name, value);
    }
  }

  protected async getStateValue<T>(stateName: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const value = await this.getStateManager<T>().getState(stateName);
      if (value === undefined) {
        return defaultValue;
      }
      return value as T;
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

function createInstanceFromProperty(property: StateProperty, rawValue?: any) {
  // This method is a little complex, but we're trying to be a nice to the end user as possible
  try {
    if (property.serializable) {
      let instance: IState;
      if (typeof property.defaultValue === 'function') {
        instance = property.defaultValue();
      } else {
        // New up a new instance of the type (call the constructor)
        // Assuming that the type has a default constructor
        instance = createInstanceOfType(property.type);
      }
      if (instance.fromJSON) {
        return instance.fromJSON(rawValue) ?? instance;
      } else {
        // For each of the raw values properties, set the instance property of the same name
        for (const key of Object.keys(rawValue)) {
          (instance as any)[key] = rawValue[key];
        }
        return instance;
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
        instance = createInstanceOfType(property.type);
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

function createInstanceOfType<T>(type: Constructor<T> | { new (): T } | any): T {
  try {
    return new type();
  } catch (e) {
    // If we get an error, then it is likely that the type does not have a default constructor
    // Or cannot be instantiated up using the `new` keyword, so lets just return undefined
    return undefined as T;
  }
}

type Constructor<T = any> = new (...args: any[]) => T;
