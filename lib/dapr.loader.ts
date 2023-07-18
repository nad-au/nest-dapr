import { DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';

@Injectable()
export class DaprLoader
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DaprLoader.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly daprServer: DaprServer,
    private readonly daprMetadataAccessor: DaprMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  async onApplicationBootstrap() {
    this.loadDaprHandlers();
    this.logger.log('Starting Dapr server');
    await this.daprServer.start();
    this.logger.log('Dapr server started');
  }

  async onApplicationShutdown() {
    this.logger.log('Stopping Dapr server');
    await this.daprServer.stop();
    this.logger.log('Dapr server stopped');
  }

  loadDaprHandlers() {
    const providers = this.discoveryService.getProviders();
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
          return DaprPubSubStatusEnum.SUCCESS;
        } catch (err) {
          this.logger.debug('Retrying pubsub handler operation');
          return DaprPubSubStatusEnum.RETRY;
        }
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
}
