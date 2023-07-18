import { DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';
import { DAPR_MODULE_OPTIONS_TOKEN, DaprModuleOptions } from './dapr.module';

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
    @Inject(DAPR_MODULE_OPTIONS_TOKEN)
    private readonly options: DaprModuleOptions,
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
}
