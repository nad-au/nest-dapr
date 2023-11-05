import { AbstractActor, DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import Class from '@dapr/dapr/types/Class';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Type,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DaprActorClient } from './actors/dapr-actor-client.service';
import { patchActorManagerForNest } from './actors/nest-actor-manager';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';
import { DAPR_MODULE_OPTIONS_TOKEN, DaprModuleOptions } from './dapr.module';

@Injectable()
export class DaprLoader
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DaprLoader.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly daprServer: DaprServer,
    private readonly daprMetadataAccessor: DaprMetadataAccessor,
    @Inject(DAPR_MODULE_OPTIONS_TOKEN)
    private readonly options: DaprModuleOptions,
    private readonly daprActorClient: DaprActorClient,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap() {
    await patchActorManagerForNest(this.moduleRef);
    await this.daprServer.actor.init();
    this.loadDaprHandlers();
    this.logger.log('Starting Dapr server');
    await this.daprServer.start();
    this.logger.log('Dapr server started');

    const resRegisteredActors =
      await this.daprServer.actor.getRegisteredActors();
    this.logger.log(`Registered Actors: ${resRegisteredActors.join(', ')}`);
  }

  async onApplicationShutdown() {
    this.logger.log('Stopping Dapr server');
    await this.daprServer.stop();
    this.logger.log('Dapr server stopped');
  }

  loadDaprHandlers() {
    const providers = this.discoveryService.getProviders();

    // Find and register actors
    providers
      .filter(
        (wrapper) =>
          wrapper.isDependencyTreeStatic() &&
          wrapper.metatype &&
          this.daprMetadataAccessor.getDaprActorMetadata(wrapper.metatype),
      )
      .forEach(async (wrapper) => {
        await this.registerActor(wrapper.metatype);
      });

    // Find and register pubsub and binding handlers
    const controllers = this.discoveryService.getControllers();
    [...providers, ...controllers]
      .filter((wrapper) => wrapper.isDependencyTreeStatic())
      .filter((wrapper) => wrapper.instance)
      .forEach(async (wrapper: InstanceWrapper) => {
        const { instance } = wrapper;
        const prototype = Object.getPrototypeOf(instance) || {};
        this.metadataScanner.scanFromPrototype(
          instance,
          prototype,
          async (methodKey: string) => {
            await this.subscribeToDaprPubSubEventIfListener(
              instance,
              methodKey,
            );
            await this.subscribeToDaprBindingEventIfListener(
              instance,
              methodKey,
            );
          },
        );
      });
  }

  private async subscribeToDaprPubSubEventIfListener(
    instance: Record<string, any>,
    methodKey: string,
  ) {
    const daprPubSubMetadata =
      this.daprMetadataAccessor.getDaprPubSubHandlerMetadata(
        instance[methodKey],
      );
    if (!daprPubSubMetadata) {
      return;
    }
    const { name, topicName, route } = daprPubSubMetadata;

    this.logger.log(
      `Subscribing to Dapr: ${name}, Topic: ${topicName}${
        route ? ' on route ' + route : ''
      }`,
    );
    await this.daprServer.pubsub.subscribe(
      name,
      topicName,
      async (data: any) => {
        try {
          await instance[methodKey].call(instance, data);
        } catch (err) {
          if (this.options.onError) {
            const response = this.options.onError(name, topicName, err);
            if (response == DaprPubSubStatusEnum.RETRY) {
              this.logger.debug('Retrying pubsub handler operation');
            } else if (response == DaprPubSubStatusEnum.DROP) {
              this.logger.debug('Dropping message');
            }
            return response;
          }
        }
        return DaprPubSubStatusEnum.SUCCESS;
      },
      route,
    );
  }

  private async subscribeToDaprBindingEventIfListener(
    instance: Record<string, any>,
    methodKey: string,
  ) {
    const daprBindingMetadata =
      this.daprMetadataAccessor.getDaprBindingHandlerMetadata(
        instance[methodKey],
      );
    if (!daprBindingMetadata) {
      return;
    }
    const { name } = daprBindingMetadata;

    this.logger.log(`Registering Dapr binding: ${name}`);
    await this.daprServer.binding.receive(name, async (data: any) => {
      await instance[methodKey].call(instance, data);
    });
  }

  private async registerActor<T>(actorType: Type<T> | Function) {
    if (!actorType) return;

    const actorTypeName = actorType.name ?? actorType.constructor.name;

    // We need to get the @DaprActor decorator metadata
    const daprActorMetadata =
      this.daprMetadataAccessor.getDaprActorMetadata(actorType);

    const interfaceTypeName =
      daprActorMetadata?.interfaceType?.name ??
      daprActorMetadata?.interfaceType?.constructor.name;

    this.logger.log(
      `Registering Dapr Actor: ${actorTypeName} of type ${
        interfaceTypeName ?? 'unknown'
      }`,
    );
    await this.daprServer.actor.registerActor(
      actorType as Class<AbstractActor>,
    );
    // Register the base actor type as a client
    this.daprActorClient.register(
      actorTypeName,
      actorType,
      this.daprServer.client,
    );
    // If an interface is provided, register the interface as a client
    if (daprActorMetadata.interfaceType) {
      this.daprActorClient.registerInterface(
        actorType,
        daprActorMetadata.interfaceType,
        this.daprServer.client,
      );
    }
    return actorTypeName;
  }
}
