import { ActorId } from '@dapr/dapr';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import { Scope, Type } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Injector } from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

export function patchActorManagerForNest(moduleRef: ModuleRef) {
  const originalCreateActor = ActorManager.prototype.createActor;

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
}

async function resolveDependencies(
  moduleRef: ModuleRef,
  instance: any,
): Promise<void> {
  const type = instance.constructor;
  try {
    const injector = (moduleRef as any).injector as Injector;
    const contextId = ContextIdFactory.create();
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
