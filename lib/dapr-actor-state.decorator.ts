import { DAPR_ACTOR_STATE_METADATA } from './constants';

export interface StateProperty {
  key: string | symbol;
  name: string;
  type: Function;
  defaultValue?: any;
}

export function State(options?: {
  defaultValue?: any;
  name?: string;
}): PropertyDecorator {
  return (target, propertyKey) => {
    const properties: StateProperty[] =
      Reflect.getMetadata(DAPR_ACTOR_STATE_METADATA, target.constructor) || [];
    // Get the type of the property (might be useful for conversions later)
    const type = Reflect.getMetadata('design:type', target, propertyKey);
    properties.push({
      key: propertyKey,
      name: options?.name ?? propertyKey.toString(),
      type,
      defaultValue: options?.defaultValue,
    });
    Reflect.defineMetadata(
      DAPR_ACTOR_STATE_METADATA,
      properties,
      target.constructor,
    );
  };
}
