import { ActorId } from '@dapr/dapr';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import { Scope, Type } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Injector } from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

export function patchActorManagerForNest(
  moduleRef: ModuleRef,
  invokeWrapperFn?: (
    actorId: ActorId,
    methodName: string,
    data: any,
    method: (actorId: ActorId, methodName: string, data: any) => Promise<any>,
  ) => Promise<any>,
) {
  // The original create actor method
  const originalCreateActor = ActorManager.prototype.createActor;
  // The original invoke actor method call
  const originalCallActor = ActorManager.prototype.callActorMethod;

  // We need replace/patch the original createActor method to resolve dependencies from the Nest Dependency Injection container
  ActorManager.prototype.createActor = async function (actorId: ActorId) {
    // Call the original createActor method
    const instance = await originalCreateActor.bind(this)(actorId);

    // Attempt to resolve dependencies from the Nest Dependency Injection container
    try {
      await resolveDependencies(moduleRef, instance);
    } catch (error) {
      console.error(error);
      throw error;
    }
    return instance;
  };

  // The parameter invokeWrapperFn is an optional async function the user can pass in which then acts as the
  // wrapper for all callActorMethod calls.
  if (invokeWrapperFn) {
    // We need to replace/patch the original callActorMethod method to run inside the wrapper function so that the user
    ActorManager.prototype.callActorMethod = async function (
      actorId: ActorId,
      methodName: string,
      data: any,
    ) {
      return await invokeWrapperFn(
        actorId,
        methodName,
        data,
        originalCallActor.bind(this),
      );
    };
  }
}

export interface ActorMethodInvocation {
  actorId: ActorId;
  method: string;
  data: any;
}

async function resolveDependencies(
  moduleRef: ModuleRef,
  instance: any,
): Promise<void> {
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

    const properties = injector.reflectProperties(
      wrapper.metatype as Type<any>,
    );
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
