import { SetMetadata } from '@nestjs/common';
import { DAPR_PUBSUB_METADATA } from './constants';

/**
 * `@DaprBinding` decorator metadata
 */
export interface DaprActorPubSubMetadata {
  /**
   * Name of pubsub component.
   */
  name: string;

  /**
   * Topic name to subscribe.
   */
  eventName: string;

  /**
   * Function to use to obtain the actor id from the message payload.
   */
  id: (message: any) => string;
}

/**
 * Dapr Actor pubsub decorator.
 * Subscribes to Dapr pubsub topics and routes them to actor methods.
 *
 * @param options name, topic and id (optional)
 */
export const DaprActorPubSub = (options: DaprActorEventHandlerMetadata): MethodDecorator =>
  SetMetadata(DAPR_PUBSUB_METADATA, options);
