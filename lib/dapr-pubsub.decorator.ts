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
}

/**
 * Dapr pubsub decorator.
 * Subscribes to Dapr pubsub topics.
 *
 * @param name name of pubsub component
 * @param topicName topic name to subscribe
 */
export const DaprPubSub = (name: string, topicName: string): MethodDecorator =>
  SetMetadata(DAPR_PUBSUB_METADATA, { name, topicName } as DaprPubSubMetadata);
