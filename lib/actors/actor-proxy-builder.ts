import { ActorId, CommunicationProtocolEnum, DaprClient } from '@dapr/dapr';
import ActorClient from '@dapr/dapr/actors/client/ActorClient/ActorClient';
import Class from '@dapr/dapr/types/Class';
import { DaprClientOptions } from '@dapr/dapr/types/DaprClientOptions';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DaprContextService } from '../dapr-context-service';
import { ActorRuntimeService } from './actor-runtime.service';
import { DaprClientCache } from './client-cache';

export class ActorProxyBuilder<T> {
  moduleRef: ModuleRef;
  daprContextService: DaprContextService;
  actorRuntimeService: ActorRuntimeService;
  actorClient: ActorClient;
  actorTypeClass: Class<T>;
  allowInternalCalls: boolean;

  constructor(moduleRef: ModuleRef, actorTypeClass: Class<T>, daprClient: DaprClient);
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
    this.actorRuntimeService = moduleRef.get(ActorRuntimeService, {
      strict: false,
    });
    this.actorTypeClass = actorTypeClass;

    if (args.length == 1) {
      const [daprClient] = args;
      this.actorClient = DaprClientCache.getOrCreateActorClientFromClient(daprClient);
    } else {
      const [host, port, communicationProtocol, clientOptions] = args;
      const options: DaprClientOptions = {
        daprHost: host,
        daprPort: port,
        communicationProtocol: communicationProtocol,
        ...clientOptions,
      };
      this.actorClient = DaprClientCache.getOrCreateActorClientFromOptions(options);
    }
  }

  build(actorId: ActorId, actorTypeName?: string): T {
    const actorTypeClassName = actorTypeName ?? this.actorTypeClass.name;

    const handler = {
      get: (_target: any, propKey: any, _receiver: any) => {
        // This is the method that will be called when the proxy is used
        return async (...args: any) => {
          // The propKey is the method name, and the args are the method arguments
          // If the actor is internally known to this process, we can call the method directly (without going through the sidecar)
          // Note: This can be a bad idea as the actor might be moved to another process or be deactivated
          // Caution: Calls to actors are current not protected by any locking mechanism internally
          if (this.isInternalActor(actorId)) {
            return await this.callInternalActorMethod(actorTypeClassName, actorId, propKey, args);
          } else {
            return await this.callExternalActorMethod(actorTypeClassName, actorId, propKey, args);
          }
        };
      },
    };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy
    // we implement a handler that will take a method and forward it to the actor client
    const proxy = new Proxy(this.actorTypeClass, handler);
    return proxy as unknown as T;
  }

  private isInternalActor(actorId: ActorId): boolean {
    // If internal calls are not allowed, then we should always call the sidecar
    if (!this.allowInternalCalls) return false;
    return this.actorRuntimeService.hasActor(this.actorTypeClass, actorId.getId());
  }

  private async callInternalActorMethod(
    actorTypeClassName: string,
    actorId: ActorId,
    methodName: string,
    args: any[],
  ): Promise<any> {
    const actorManager = this.actorRuntimeService.getActorManager(actorTypeClassName);
    const requestBody = JSON.stringify(args);
    return await actorManager.invoke(actorId, methodName, Buffer.from(requestBody));
  }

  private async callExternalActorMethod(
    actorTypeClassName: string,
    actorId: ActorId,
    methodName: string,
    args: any[],
  ): Promise<any> {
    const originalBody = args.length > 0 ? args : null;
    // As we are invoking this method via the sidecar we want to prepare the body and inject it with any context/correlation ID
    const body = await this.prepareBody(this.daprContextService, args, originalBody);
    // Either get the correlation ID from the context or generate a new one
    const correlationId = this.daprContextService.getCorrelationId(true);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await this.actorClient.actor.invoke(actorTypeClassName, actorId, methodName, body, correlationId);
  }

  private async prepareBody(daprContextService: DaprContextService, args: any[], body: any): Promise<any> {
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
      Logger.error(error);
      return body;
    }
  }
}
