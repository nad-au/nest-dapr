import { Type } from '@nestjs/common';
import { DAPR_ACTOR_STATE_METADATA } from './constants';

export interface StateProperty {
  key: string | symbol;
  name: string;
  type: Function | Type<any>;
  defaultValue?: (() => any) | Function | Type<any>;
  serializable?: boolean;
}

export function State(options?: {
  defaultValue?: (() => any) | Function | Type<any>;
  name?: string;
}): PropertyDecorator {
  return (target, propertyKey) => {
    const properties: StateProperty[] = Reflect.getMetadata(DAPR_ACTOR_STATE_METADATA, target.constructor) || [];
    // Get the type of the property (might be useful for conversions later)
    const type = Reflect.getMetadata('design:type', target, propertyKey);
    // Check to see if the type is serializable (See IState)
    // If it contains the functions `fromJSON` and `toJSON` then we can assume it is serializable
    const serializable =
      typeof type.prototype['fromJSON'] === 'function' && typeof type.prototype['toJSON'] === 'function';
    properties.push({
      key: propertyKey,
      name: options?.name ?? propertyKey.toString(),
      type,
      defaultValue: options?.defaultValue,
      serializable,
    });
    Reflect.defineMetadata(DAPR_ACTOR_STATE_METADATA, properties, target.constructor);
  };
}
