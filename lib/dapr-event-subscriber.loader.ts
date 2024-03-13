import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DaprActorClient } from './actors/dapr-actor-client.service';
import { DaprActorOnEventMetadata } from './dapr-actor-on-event.decorator';
import { DaprActorMetadata } from './dapr-actor.decorator';
import { DaprEventEmitter } from './dapr-event-emitter.service';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';

@Injectable()
export class DaprEventSubscriberLoader implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('DaprEventSubscriber');

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataAccessor: DaprMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
    private readonly eventEmitter: DaprEventEmitter,
    private readonly actorClient: DaprActorClient,
  ) {}

  onApplicationBootstrap() {
    this.loadEventListeners();
  }

  onApplicationShutdown() {
    this.eventEmitter.removeAllListeners();
  }

  loadEventListeners() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    [...providers, ...controllers]
      .filter((wrapper) => wrapper.instance && !wrapper.isAlias)
      .forEach((wrapper: InstanceWrapper) => {
        const { instance } = wrapper;
        const prototype = Object.getPrototypeOf(instance) || {};
        this.metadataScanner.scanFromPrototype(instance, prototype, (methodKey: string) =>
          this.subscribeToEventIfListener(instance, methodKey),
        );
      });
  }

  private subscribeToEventIfListener(instance: Record<string, any>, methodKey: string) {
    const actorMetadata = this.metadataAccessor.getDaprActorMetadata(instance.constructor);
    if (!actorMetadata) {
      return;
    }
    const eventListenerMetadatas = this.metadataAccessor.getDaprEventHandlerMetadata(instance[methodKey]);
    if (!eventListenerMetadatas) {
      return;
    }

    for (const eventListenerMetadata of eventListenerMetadatas) {
      // If the metadata has no actorId lookup function, we cannot resolve the actor
      if (!eventListenerMetadata.actorId) continue;
      this.registerActorEventListener(
        actorMetadata,
        eventListenerMetadata,
        methodKey,
        eventListenerMetadata.ignoreErrors,
      );
    }
  }

  private registerActorEventListener(
    actorMetadata: DaprActorMetadata,
    eventMetadata: DaprActorOnEventMetadata<any>,
    methodKey: string,
    ignoreErrors = false,
  ) {
    this.eventEmitter.on(
      eventMetadata.event,
      async (data: any) => {
        try {
          let actorIds = eventMetadata.actorId(data);
          // If the actorId resolves to undefined, we cannot resolve the actor/destination
          // Do not throw an error, just ignore the event
          if (actorIds === undefined) {
            return;
          }

          if (!Array.isArray(actorIds)) {
            actorIds = [actorIds];
          }

          // If there are no actorIds, we cannot resolve the actor/destination
          // Do not throw an error, just ignore the event
          if (actorIds.length === 0) {
            return;
          }

          for (const id of actorIds) {
            const actorType = actorMetadata.interfaceType.name ?? actorMetadata.interfaceType.constructor.name;
            const actor = this.actorClient.getActorByTypeName(actorType, id);
            await actor[methodKey].call(actor, data);
          }
        } catch (e) {
          this.logger.error(e);
          // The default is to throw the error
          if (!ignoreErrors) {
            throw e;
          }
        }
      },
      {
        // These options are required so that emitters await the event listeners
        async: true,
        promisify: true,
      },
    );
  }
}
