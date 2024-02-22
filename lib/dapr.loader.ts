import { AbstractActor, DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import ActorRuntime from '@dapr/dapr/actors/runtime/ActorRuntime';
import Class from '@dapr/dapr/types/Class';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Type } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DaprActorClient } from './actors/dapr-actor-client.service';
import { NestActorManager } from './actors/nest-actor-manager';
import { DaprContextService } from './dapr-context-service';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';
import { DAPR_MODULE_OPTIONS_TOKEN, DaprContextProvider, DaprModuleOptions } from './dapr.module';

@Injectable()
export class DaprLoader implements OnApplicationBootstrap, OnApplicationShutdown {
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
    private readonly contextService: DaprContextService,
    private readonly actorManager: NestActorManager,
  ) {}

  async onApplicationBootstrap() {
    if (this.options.disabled) {
      this.logger.log('Dapr server is disabled');
      return;
    }

    // Hook into the Dapr Actor Manager
    this.actorManager.setup(this.moduleRef, this.options.actorOptions);
    // Setup CLS/ALS for async context propagation
    if (this.options.contextProvider !== DaprContextProvider.None) {
      this.actorManager.setupCSLWrapper(this.contextService);
    }
    if (this.options.clientOptions?.actor?.reentrancy?.enabled) {
      this.actorManager.setupReentrancy();
    }

    // Setup the actor client (based on the options provided)
    if (this.options.actorOptions) {
      this.daprActorClient.setAllowInternalCalls(this.options.actorOptions?.allowInternalCalls ?? false);
      this.daprActorClient.setPrefix(
        this.options.actorOptions?.prefix ?? '',
        this.options.actorOptions?.delimiter ?? '-',
      );
      this.daprActorClient.setTypeNamePrefix(this.options.actorOptions?.typeNamePrefix ?? '');
      if (this.options.actorOptions?.prefix) {
        this.logger.log(
          `Actors will be prefixed with ${this.options.actorOptions?.prefix ?? ''} and delimited with ${
            this.options.actorOptions?.delimiter ?? '-'
          }`,
        );
      }
    }

    await this.daprServer.actor.init();

    this.loadDaprHandlers();

    // If the dapr server port is 0, then we will assume that the server is not to be started
    if (this.options.serverPort === '0') {
      this.logger.log('Dapr server will not be started');
      return;
    }

    this.logger.log('Starting Dapr server');

    if (this.options.catchErrors) {
      // We need to add error handling middleware to the Dapr server
      const server = this.daprServer.daprServer.getServer(); // Express JS
      if (server) {
        server.use((err, req, res, next) => {
          // Catch any errors, log them and return a 500
          if (err) {
            this.logger.error(err, err.stack, 'DaprServer');
            res.status(500).send(err);
          }
        });
      }
    }

    await this.daprServer.start();
    this.logger.log('Dapr server started');

    const resRegisteredActors = await this.daprServer.actor.getRegisteredActors();
    if (resRegisteredActors.length > 0) {
      this.logger.log(`Registered Actors: ${resRegisteredActors.join(', ')}`);
    }
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
        this.metadataScanner.scanFromPrototype(instance, prototype, async (methodKey: string) => {
          await this.subscribeToDaprPubSubEventIfListener(instance, methodKey);
          await this.subscribeToDaprBindingEventIfListener(instance, methodKey);
        });
      });
  }

  private async subscribeToDaprPubSubEventIfListener(instance: Record<string, any>, methodKey: string) {
    const daprPubSubMetadata = this.daprMetadataAccessor.getDaprPubSubHandlerMetadata(instance[methodKey]);
    if (!daprPubSubMetadata) {
      return;
    }
    const { name, topicName, route } = daprPubSubMetadata;

    this.logger.log(`Subscribing to Dapr: ${name}, Topic: ${topicName}${route ? ' on route ' + route : ''}`);
    await this.daprServer.pubsub.subscribe(
      name,
      topicName,
      async (data: any) => {
        try {
          // The first argument will be the data
          await instance[methodKey].call(instance, data);
          // If no exception has occurred, then return success
          return DaprPubSubStatusEnum.SUCCESS;
        } catch (err) {
          this.logger.error(err, `Error in pubsub handler ${topicName}`);
          // If there is an error handler then use it.
          if (this.options.onPubSubError) {
            const response = this.options.onPubSubError(name, topicName, err);
            if (response == DaprPubSubStatusEnum.RETRY) {
              this.logger.log(`Retrying pubsub handler ${topicName} operation`);
            } else if (response == DaprPubSubStatusEnum.DROP) {
              this.logger.debug(`Dropping message from ${topicName}`);
            }
            return response;
          }
          // The safest default return type is retry.
          this.logger.log(`Retrying pubsub handler ${topicName} operation`);
          return DaprPubSubStatusEnum.RETRY;
        }
      },
      route,
    );
  }

  private async subscribeToDaprBindingEventIfListener(instance: Record<string, any>, methodKey: string) {
    const daprBindingMetadata = this.daprMetadataAccessor.getDaprBindingHandlerMetadata(instance[methodKey]);
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

    let actorTypeName = actorType.name ?? actorType.constructor.name;

    // We need to get the @DaprActor decorator metadata
    const daprActorMetadata = this.daprMetadataAccessor.getDaprActorMetadata(actorType);

    const interfaceTypeName =
      daprActorMetadata?.interfaceType?.name ?? daprActorMetadata?.interfaceType?.constructor.name;

    // The option typeNamePrefix allows you to specify a prefix for the actor type name
    // For example CounterActor with prefix of 'Prod' would be ProdCounterActor
    // This is useful in scenarios where environments may share the same placement service
    if (this.options.actorOptions?.typeNamePrefix) {
      actorTypeName = this.options.actorOptions.typeNamePrefix + actorTypeName;
      // Register using a custom actor manager
      try {
        const actorManager = ActorRuntime.getInstanceByDaprClient(this.daprServer.client);
        const managers = actorManager['actorManagers'] as Map<string, ActorManager<any>>;
        if (!managers.has(actorTypeName)) {
          managers.set(actorTypeName, new ActorManager(actorType as Class<AbstractActor>, this.daprServer.client));
        }
      } catch (err) {
        await this.daprServer.actor.registerActor(actorType as Class<AbstractActor>);
      }
    } else {
      // Register as normal
      await this.daprServer.actor.registerActor(actorType as Class<AbstractActor>);
    }

    this.logger.log(`Registering Dapr Actor: ${actorTypeName} of type ${interfaceTypeName ?? 'unknown'}`);

    // Register the base actor type as a client
    this.daprActorClient.register(actorTypeName, actorType, this.daprServer.client);
    // If an interface is provided, register the interface as a client
    if (daprActorMetadata.interfaceType) {
      this.daprActorClient.registerInterface(actorType, daprActorMetadata.interfaceType, this.daprServer.client);
    }
    return actorTypeName;
  }
}
