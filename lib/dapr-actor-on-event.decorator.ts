import { extendArrayMetadata } from '@nestjs/common/utils/extend-metadata.util';
import { DAPR_ACTOR_EVENT_METADATA } from './constants';

/**
 * `@DaprActorOnEvent` decorator metadata
 */
export interface DaprActorOnEventMetadata<T> {
  /**
   * Event (name or pattern) to subscribe to.
   */
  event: DaprActorEventType;

  /**
   * Function to obtain the Actor/Producer ID from the event payload.
   */
  actorId: (payload: T) => string;

  /**
   * Ignore errors.
   */
  ignoreErrors?: boolean;
}

/**
 * `@DaprActorOnEvent` decorator event type
 */
export type DaprActorEventType = string | symbol | string[] | symbol[];

/**
 * Event listener decorator.
 * Subscribes to events based on the specified name(s).
 *
 * @param event event to subscribe to
 * @param actorId function to obtain the Actor/Producer ID from the event payload. If not provided the Actor cannot be resolved.
 * @param ignoreErrors ignore errors (default: false)
 */
export function DaprActorOnEvent<T>(
  event: DaprActorEventType,
  actorId: (payload: T) => string,
  ignoreErrors?: boolean,
): MethodDecorator {
  const decoratorFactory = (target: object, key?: any, descriptor?: any) => {
    extendArrayMetadata(
      DAPR_ACTOR_EVENT_METADATA,
      [{ event, actorId, ignoreErrors } as DaprActorOnEventMetadata<T>],
      descriptor.value,
    );
    return descriptor;
  };
  decoratorFactory.KEY = DAPR_ACTOR_EVENT_METADATA;
  return decoratorFactory;
}
