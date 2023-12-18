import { randomUUID } from 'crypto';
import { AbstractActor, ActorId } from '@dapr/dapr';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import { Injectable, Logger, Scope, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { CLS_ID } from 'nestjs-cls';
import { DaprContextService } from '../dapr-context-service';
import { DaprModuleActorOptions } from '../dapr.module';

@Injectable()
export class NestActorManager {
  setup(
    moduleRef: ModuleRef,
    options: DaprModuleActorOptions,
    onActivateFn?: (actorId: ActorId, instance: AbstractActor) => Promise<void>,
  ) {
    // The original create actor method
    const originalCreateActor = ActorManager.prototype.createActor;
    const resolveDependencies = this.resolveDependencies;

    // We need replace/patch the original createActor method to resolve dependencies from the Nest Dependency Injection container
    ActorManager.prototype.createActor = async function (actorId: ActorId) {
      // Call the original createActor method
      const instance = (await originalCreateActor.bind(this)(actorId)) as AbstractActor;
      if (options?.typeNamePrefix) {
        // This is where we override the Actor Type Name at runtime
        // This means it may differ from the instance/ctor name.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        instance['actorType'] = `${options.typeNamePrefix}${instance.actorType}`;
      }

      // Attempt to resolve dependencies from the Nest Dependency Injection container
      try {
        await resolveDependencies(moduleRef, instance);
        if (onActivateFn) {
          await onActivateFn(actorId, instance);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
      return instance;
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
      console.error(error);
      throw error;
    }
  }

  setupCSLWrapper(
    contextService: DaprContextService,
    invokeWrapperFn?: (
      actorId: ActorId,
      methodName: string,
      data: any,
      method: (actorId: ActorId, methodName: string, data: any) => Promise<any>,
    ) => Promise<any>,
  ) {
    const clsService = contextService.getService();
    if (!clsService) {
      throw new Error(`Unable to resolve a CLS from the NestJS DI container`);
    }

    // The original invoke actor method call
    const originalCallActor = ActorManager.prototype.callActorMethod;

    // Create a new callActor method that wraps CLS
    ActorManager.prototype.callActorMethod = async function (actorId: ActorId, methodName: string, data: any) {
      // Try catch, log and rethrow any errors
      try {
        return await clsService.run(async () => {
          clsService.setIfUndefined<any>(CLS_ID, randomUUID());
          // Try to extract the context from the data object
          const context = NestActorManager.extractContext(data);
          // If we have found a context object, set it in the CLS
          if (context) {
            contextService.set(context);
            // Remove the context from the data object
            data = NestActorManager.removeContext(data);
          }
          if (invokeWrapperFn) {
            return await invokeWrapperFn(actorId, methodName, data, originalCallActor.bind(this));
          } else {
            return await originalCallActor.bind(this)(actorId, methodName, data);
          }
        });
      } catch (error) {
        Logger.error(`Error invoking actor method ${actorId}/${methodName}`);
        Logger.error(error);
        throw error;
      }
    };
  }

  private static extractContext(data: any): any {
    if (!data) return undefined;
    // The context object should always be the last item in the array
    if (Array.isArray(data)) {
      const lastItem = data[data.length - 1];
      if (lastItem['$t'] === 'ctx') {
        return lastItem;
      }
    }
    // Perhaps the context is the entire object?
    if (data['$t'] === 'ctx') {
      return data;
    }
    // Allow embedding the context as a property
    return data['$ctx'];
  }

  private static removeContext(data: any): any {
    if (!data) return undefined;
    if (Array.isArray(data)) {
      const lastItem = data[data.length - 1];
      if (lastItem['$t'] === 'ctx') {
        return data.slice(0, data.length - 1);
      }
    }
    // Perhaps the context is the entire object?
    if (data['$t'] === 'ctx') {
      return undefined;
    }
    // Allow embedding the context as a property
    if (data['$ctx']) {
      data['$ctx'] = undefined;
    }
    return data;
  }
}

export interface ActorMethodInvocation {
  actorId: ActorId;
  method: string;
  data: any;
}
