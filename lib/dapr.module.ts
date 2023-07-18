import {
  CommunicationProtocolEnum,
  DaprClient,
  DaprPubSubStatusEnum,
  DaprServer,
} from '@dapr/dapr';
import { DaprClientOptions } from '@dapr/dapr/types/DaprClientOptions';
import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
  Type,
} from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';
import { DaprLoader } from './dapr.loader';

export const DAPR_MODULE_OPTIONS_TOKEN = 'DAPR_MODULE_OPTIONS_TOKEN';

export interface DaprModuleOptions {
  serverHost?: string;
  serverPort?: string;
  communicationProtocol?: CommunicationProtocolEnum;
  clientOptions?: DaprClientOptions;
  onError?: (
    name: string,
    topicName: string,
    error: any,
  ) => DaprPubSubStatusEnum;
}

export interface DaprModuleOptionsFactory {
  createDaprModuleOptions(): Promise<DaprModuleOptions> | DaprModuleOptions;
}

export function createOptionsProvider(options: DaprModuleOptions): any {
  return { provide: DAPR_MODULE_OPTIONS_TOKEN, useValue: options || {} };
}

export interface DaprModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<DaprModuleOptionsFactory>;
  useClass?: Type<DaprModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<DaprModuleOptions> | DaprModuleOptions;
  inject?: any[];
  extraProviders?: Provider[];
}

@Module({})
export class DaprModule {
  static register(options?: DaprModuleOptions): DynamicModule {
    return {
      global: true,
      module: DaprModule,
      imports: [DiscoveryModule],
      providers: [
        createOptionsProvider(options),
        {
          provide: DaprServer,
          useValue: new DaprServer({
            serverHost: options.serverHost,
            serverPort: options.serverPort,
            clientOptions: options.clientOptions,
            communicationProtocol: options.communicationProtocol,
          }),
        },
        {
          provide: DaprClient,
          useFactory: (daprServer: DaprServer) => daprServer.client,
          inject: [DaprServer],
        },
        DaprLoader,
        DaprMetadataAccessor,
      ],
      exports: [DaprClient],
    };
  }

  static registerAsync(options: DaprModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: DaprModule,
      imports: [...options.imports, DiscoveryModule],
      providers: [
        ...this.createAsyncProviders(options),
        {
          provide: DaprServer,
          useFactory: ({
            serverHost,
            serverPort,
            communicationProtocol,
            clientOptions,
          }: DaprModuleOptions) =>
            new DaprServer({
              serverHost,
              serverPort,
              clientOptions,
              communicationProtocol,
            }),
          inject: [DAPR_MODULE_OPTIONS_TOKEN],
        },
        {
          provide: DaprClient,
          useFactory: (daprServer: DaprServer) => daprServer.client,
          inject: [DaprServer],
        },
        DaprLoader,
        DaprMetadataAccessor,
        ...(options.extraProviders || []),
      ],
      exports: [DaprClient],
    };
  }

  private static createAsyncProviders(
    options: DaprModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: DaprModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: DAPR_MODULE_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: DAPR_MODULE_OPTIONS_TOKEN,
      useFactory: async (optionsFactory: DaprModuleOptionsFactory) =>
        optionsFactory.createDaprModuleOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
