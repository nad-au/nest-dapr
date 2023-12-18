import { ActorId, CommunicationProtocolEnum, DaprClient } from '@dapr/dapr';
import ActorClient from '@dapr/dapr/actors/client/ActorClient/ActorClient';
import Class from '@dapr/dapr/types/Class';
import { DaprClientOptions } from '@dapr/dapr/types/DaprClientOptions';
import { ModuleRef } from '@nestjs/core';
import { DaprContextService } from '../dapr-context-service';

export class ActorProxyBuilder<T> {
  moduleRef: ModuleRef;
  daprContextService: DaprContextService;
  actorClient: ActorClient;
  actorTypeClass: Class<T>;

  constructor(
    moduleRef: ModuleRef,
    actorTypeClass: Class<T>,
    daprClient: DaprClient,
  );
  constructor(
    moduleRef: ModuleRef,
    actorTypeClass: Class<T>,
    host: string,
    port: string,
    communicationProtocol: CommunicationProtocolEnum,
    clientOptions: DaprClientOptions,
  );
  constructor(moduleRef: ModuleRef, actorTypeClass: Class<T>, ...args: any[]) {
    this.moduleRef = moduleRef;
    this.daprContextService = moduleRef.get(DaprContextService, {
      strict: false,
    });
    this.actorTypeClass = actorTypeClass;

    if (args.length == 1) {
      const [daprClient] = args;
      this.actorClient = new ActorClient(
        daprClient.options.daprHost,
        daprClient.options.daprPort,
        daprClient.options.communicationProtocol,
        daprClient.options,
      );
    } else {
      const [host, port, communicationProtocol, clientOptions] = args;
      this.actorClient = new ActorClient(
        host,
        port,
        communicationProtocol,
        clientOptions,
      );
    }
  }

  build(actorId: ActorId, actorTypeName?: string): T {
    const actorTypeClassName = actorTypeName ?? this.actorTypeClass.name;
    const actorClient = this.actorClient;

    const handler = {
      get: (_target: any, propKey: any, _receiver: any) => {
        return async (...args: any) => {
          const originalBody = args.length > 0 ? args : null;
          const body = await this.prepareBody(
            this.daprContextService,
            args,
            originalBody,
          );
          const res = await actorClient.actor.invoke(
            actorTypeClassName,
            actorId,
            propKey,
            body,
          );
          return res;
        };
      },
    };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy
    // we implement a handler that will take a method and forward it to the actor client
    const proxy = new Proxy(this.actorTypeClass, handler);

    // Return a NOT strongly typed API
    // @todo: this should return a strongly typed API as well, but requires reflection. How to do this in typescript?
    return proxy as unknown as T;
  }

  private async prepareBody(
    daprContextService: DaprContextService,
    args: any[],
    body: any,
  ): Promise<any> {
    try {
      if (!daprContextService) return body;
      const context = daprContextService.get();
      if (context) {
        // Add the context annotation (because most likely actor-actor calls will be made via HTTP/gRPC)
        context['$t'] = 'ctx';
        if (Array.isArray(body)) {
          body.push(context);
          // Note: Very bad assumption here, but the most logical approach.
          // If the first value of the body is null, but there are only two values, then we
          // should assume the array should only contain the context.
          if (args.length === 0 && body.length === 2 && body[0] === null) {
            return [context];
          }
          return body;
        } else {
          // Note: Very bad assumption here, but the most logical approach.
          // If no arguments were given, then the output should just be the context.
          if (args.length === 0) {
            return context;
          }
          return [body, context];
        }
      }
      // No mutations were made
      return body;
    } catch (error) {
      return body;
    }
  }
}
