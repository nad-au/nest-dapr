import { Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DAPR_ACTOR_METADATA,
  DAPR_BINDING_METADATA,
  DAPR_PUBSUB_METADATA,
} from './constants';
import { DaprActorMetadata } from './dapr-actor.decorator';
import { DaprBindingMetadata } from './dapr-binding.decorator';
import { DaprPubSubMetadata } from './dapr-pubsub.decorator';

@Injectable()
export class DaprMetadataAccessor {
  constructor(private readonly reflector: Reflector) {}

  getDaprPubSubHandlerMetadata(
    target: Type<unknown>,
  ): DaprPubSubMetadata | undefined {
    return this.reflector.get(DAPR_PUBSUB_METADATA, target);
  }

  getDaprBindingHandlerMetadata(
    target: Type<unknown>,
  ): DaprBindingMetadata | undefined {
    return this.reflector.get(DAPR_BINDING_METADATA, target);
  }

  getDaprActorMetadata(
    target: Function | Type<unknown>,
  ): DaprActorMetadata | undefined {
    return this.reflector.get<DaprActorMetadata>(DAPR_ACTOR_METADATA, target);
  }
}
