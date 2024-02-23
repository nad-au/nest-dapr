import { SetMetadata } from '@nestjs/common';
import { DAPR_PUBSUB_METADATA } from './constants';

/**
 * `@DaprBinding` decorator metadata
 */
export interface DaprPubSubMetadata {
  /**
   * Name of pubsub component.
   */
  name: string;

  /**
   * Topic name to subscribe.
   */
  topicName: string;

  /**
   * Route to use.
   */
  route?: string;
}

/**
 * Dapr pubsub decorator.
 * Subscribes to Dapr pubsub topics.
 *
 * @param options name, topic and route (optional)
 */
export const DaprPubSub = (options: DaprPubSubMetadata): MethodDecorator => SetMetadata(DAPR_PUBSUB_METADATA, options);
