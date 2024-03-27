import { randomUUID } from 'crypto';
import { AbstractActor, ActorId } from '@dapr/dapr';
import ActorClientHTTP from '@dapr/dapr/actors/client/ActorClient/ActorClientHTTP';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import ActorRuntime from '@dapr/dapr/actors/runtime/ActorRuntime';
import HttpStatusCode from '@dapr/dapr/enum/HttpStatusCode.enum';
import HTTPServerActor from '@dapr/dapr/implementation/Server/HTTPServer/actor';
import { Injectable, Logger, Scope, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DAPR_CORRELATION_ID_KEY, DaprContextService } from '../dapr-context-service';
import { DaprModuleOptions } from '../dapr.module';
import { SerializableError } from './serializable-error';

@Injectable()
export class NestActorManager {
  setup(
    moduleRef: ModuleRef,
    options: DaprModuleOptions,
    onActivateFn?: (actorId: ActorId, instance: AbstractActor) => Promise<void>,
  ) {
    // Logging is enabled by default
    const isLoggingEnabled = options?.logging?.enabled ?? true;

    // The original create actor method
    const originalCreateActor = ActorManager.prototype.createActor;
    const resolveDependencies = this.resolveDependencies;

    // We need replace/patch the original createActor method to resolve dependencies from the Nest Dependency Injection container
    ActorManager.prototype.createActor = async function (actorId: ActorId) {
      // Call the original createActor method
      const instance = (await originalCreateActor.bind(this)(actorId)) as AbstractActor;
      if (options?.actorOptions?.typeNamePrefix) {
        // This is where we override the Actor Type Name at runtime
        // This means it may differ from the instance/ctor name.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        instance['actorType'] = `${options.typeNamePrefix}${instance.actorType}`;
      }

      if (isLoggingEnabled) {
        const actorTypeName = this.actorCls.name ?? instance.constructor.name;
        Logger.verbose(`Activating actor ${actorId}`, actorTypeName);
      }

      // Attempt to resolve dependencies from the Nest Dependency Injection container
      try {
        await resolveDependencies(moduleRef, instance);
        if (onActivateFn) {
          await onActivateFn(actorId, instance);
        }
      } catch (error) {
        Logger.error(error);
        if (error.stack) {
          Logger.error(error.stack);
        }
        throw error;
      }
      return instance;
    };

    // Patch existing methods to ensure they do not allow the main host to crash with an unhandled exception
    this.patchDeactivate(options);
    this.patchToSupportSerializableError(options);
    if (isLoggingEnabled) {
      // Catch and log any unhandled exceptions
      this.catchAndLogUnhandledExceptions();
    }
  }

  setupReentrancy(options: DaprModuleOptions) {
    // Here we are patching the ActorClientHTTP to support reentrancy using the `Dapr-Reentrancy-Id` header
    // All subsequent calls in a request chain must use the same correlation/reentrancy ID for the reentrancy to work
    ActorClientHTTP.prototype.invoke = async function (
      actorType: string,
      actorId: ActorId,
      methodName: string,
      body: any,
      reentrancyId?: string,
    ) {
      const urlSafeId = actorId.getURLSafeId();
      const result = await this.client.execute(`/actors/${actorType}/${urlSafeId}/method/${methodName}`, {
        method: 'POST', // we always use POST calls for Invoking (ref: https://github.com/dapr/js-sdk/pull/137#discussion_r772636068)
        body,
        headers: {
          'Dapr-Reentrancy-Id': reentrancyId ?? randomUUID(),
        },
      });
      return result as object;
    };
  }

  setupCSLWrapper(
    options: DaprModuleOptions,
    contextService: DaprContextService,
    invokeWrapperFn?: (
      actorId: ActorId,
      methodName: string,
      data: any,
      method: (actorId: ActorId, methodName: string, data: any) => Promise<any>,
    ) => Promise<any>,
  ) {
    // Here we are setting up CLS to work with the Dapr ActorManager
    const clsService = contextService.getService();
    if (!clsService) {
      throw new Error(`Unable to resolve a CLS from the NestJS DI container`);
    }

    // Logging is enabled by default
    const isLoggingEnabled = options?.logging?.enabled ?? true;

    // The original invoke actor method call
    const originalCallActor = ActorManager.prototype.callActorMethod;

    // Create a new callActor method that wraps CLS
    ActorManager.prototype.callActorMethod = async function (actorId: ActorId, methodName: string, data: any) {
      // Try catch, log and rethrow any errors
      try {
        if (isLoggingEnabled) {
          const actorTypeName = this.actorCls.name;
          Logger.verbose(`Invoking ${actorId}/${methodName}`, actorTypeName);
        }

        if (clsService.isActive()) {
          if (invokeWrapperFn) {
            return await invokeWrapperFn(actorId, methodName, data, originalCallActor.bind(this));
          } else {
            return await originalCallActor.bind(this)(actorId, methodName, data);
          }
        } else {
          // Create a new context for this actor method call
          return await clsService.run(async () => {
            contextService.setIdIfNotDefined();
            // Try to extract the context from the data object
            // This method will remove any context from the data object (destructive)
            const context = NestActorManager.extractContext(data);
            // If we have found a context object, set it in the CLS
            if (context) {
              contextService.set(context);
              // Attempt to set the correlation ID from the context
              const correlationId = context[DAPR_CORRELATION_ID_KEY] ?? randomUUID();
              if (correlationId) {
                contextService.setCorrelationId(correlationId);
              }
            }

            if (invokeWrapperFn) {
              return await invokeWrapperFn(actorId, methodName, data, originalCallActor.bind(this));
            } else {
              return await originalCallActor.bind(this)(actorId, methodName, data);
            }
          });
        }
      } catch (error) {
        Logger.error(`Error invoking actor method ${actorId}/${methodName}`);
        Logger.error(error);
        if (error.stack) {
          Logger.error(error.stack);
        }
        throw error;
      }
    };
  }

  private catchAndLogUnhandledExceptions() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Unhandled Exception:', err);
    });
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  private patchToSupportSerializableError(options: DaprModuleOptions) {
    // eslint-disable-next-line
    // @ts-ignore
    const originalHandlerMethod = HTTPServerActor.prototype.handlerMethod;
    if (!originalHandlerMethod) return;

    // eslint-disable-next-line
    // @ts-ignore
    HTTPServerActor.prototype.handlerMethod = async function (req: any, res: any) {
      const { actorTypeName, actorId, methodName } = req.params;
      const body = req.body;

      const dataSerialized = this.serializer.serialize(body);
      try {
        const result = await ActorRuntime.getInstance(this.client.daprClient).invoke(
          actorTypeName,
          actorId,
          methodName,
          dataSerialized,
        );
        res.statusCode = HttpStatusCode.OK;
        return this.handleResult(res, result);
      } catch (error) {
        if (error instanceof SerializableError) {
          // The serializable error should contain the status code or default to 400
          error.statusCode = error.statusCode ?? HttpStatusCode.BAD_REQUEST;
        } else if (error instanceof Error) {
          res.statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
        }
        return this.handleResult(res, error);
      }
    };
  }

  private patchDeactivate(options: DaprModuleOptions) {
    // Prevent deactivate from throwing an unhandled exception when the actor is not known to this server
    const isLoggingEnabled = options?.logging?.enabled ?? true;

    const originalDeactivateActor = ActorManager.prototype.deactivateActor;
    if (!originalDeactivateActor) return;

    ActorManager.prototype.deactivateActor = async function (actorId: ActorId) {
      try {
        // If the actor is not known to this server then just return without error
        // There is no need to throw an error here
        if (!this.actors.has(actorId.getId())) {
          return;
        }
        await originalDeactivateActor.bind(this)(actorId);

        if (isLoggingEnabled) {
          const actorTypeName = this.actorCls.name;
          Logger.verbose(`Deactivating actor ${actorId}`, actorTypeName);
        }
      } catch (error) {
        Logger.error(`Error deactivating actor ${actorId}`);
        Logger.error(error);
        if (error.stack) {
          Logger.error(error.stack);
        }
      }
    };
  }

  private async resolveDependencies(moduleRef: ModuleRef, instance: any): Promise<void> {
    const type = instance.constructor;
    try {
      const injector = moduleRef['injector'];
      const wrapper = new InstanceWrapper({
        name: type && type.name,
        metatype: type,
        isResolved: false,
        scope: Scope.TRANSIENT,
        durable: true,
      });

      const properties = injector.reflectProperties(wrapper.metatype as Type<any>);
      for (const item of properties) {
        if ('type' in item && item.type) {
          const propertyType = item.type as Type<any>;
          const resolved = await moduleRef.get(propertyType, { strict: false });
          if (resolved) {
            instance[item.key] = resolved;
          }
        }
      }
    } catch (error) {
      Logger.error(error);
      if (error.stack) {
        Logger.error(error.stack);
      }
      throw error;
    }
  }
  private static extractContext(data: any): any {
    try {
      if (!data) return undefined;
      // The context object should always be the last item in the array
      if (Array.isArray(data) && data.length > 0) {
        const lastItem = data[data.length - 1];
        if (lastItem['$t'] === 'ctx') {
          // Remove this item from the array
          data.pop();
          return lastItem;
        }
      }
      // Perhaps the context is the entire object?
      if (data['$t'] === 'ctx') {
        // Copy the context object and remove it from the data object
        const context = Object.assign({}, data);
        data = undefined;
        return context;
      }
      // Allow embedding the context as a property
      if (data['$ctx']) {
        const context = Object.assign({}, data['$ctx']);
        data['$ctx'] = undefined;
        return context;
      }
      return undefined;
    } catch (error) {
      Logger.error(error);
      return undefined;
    }
  }
}

export interface ActorMethodInvocation {
  actorId: ActorId;
  method: string;
  data: any;
}
