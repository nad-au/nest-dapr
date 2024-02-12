import { ActorId } from '@dapr/dapr';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';
import ActorRuntime from '@dapr/dapr/actors/runtime/ActorRuntime';
import { Injectable, Type } from '@nestjs/common';
import { DaprActorClient } from './dapr-actor-client.service';

@Injectable()
export class ActorRuntimeService {
  constructor(private readonly actorClient: DaprActorClient) {}

  // Returns the current actor runtime instance for this process
  getRuntime() {
    return ActorRuntime['instance'] as ActorRuntime;
  }

  // Returns the actor manager for the given actor type name
  getActorManager<TActorInterface>(actorTypeName: string) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.getRuntime().getActorManager<TActorInterface>(actorTypeName);
  }

  getAllActors(): Map<string, any> {
    const runtime = this.getRuntime();
    const actorManagers = runtime['actorManagers'] as Map<string, ActorManager<any>>;
    const actors = new Map<string, any>();
    for (const item of actorManagers) {
      const managerId = item[0];
      const manager = item[1];
      for (const actor of manager.actors) {
        const actorId = `${managerId}:${actor[0]}`;
        actors.set(actorId, actor[1]);
      }
    }
    return actors;
  }

  getActors<TActorInterface>(actorTypeName: string) {
    const manager = this.getActorManager<TActorInterface>(actorTypeName);
    return manager.actors;
  }

  getActor<TActorInterface>(actorType: Type<TActorInterface> | Function, actorId: string): TActorInterface {
    const typeName = actorType.name ?? actorType.constructor.name;
    // Resolve the actor type name from the interface type name/or actor type name
    const actorTypeName = this.actorClient.getActorTypeName(typeName);
    return this.getActorByTypeName<TActorInterface>(actorTypeName, actorId);
  }

  public getActorByTypeName<TActorInterface>(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.get(actorId) as TActorInterface;
  }

  public hasActor<TActorInterface>(actorType: Type<TActorInterface> | Function, actorId: string) {
    try {
      const typeName = actorType.name ?? actorType.constructor.name;
      // Resolve the actor type name from the interface type name/or actor type name
      const actorTypeName = this.actorClient.getActorTypeName(typeName);
      return this.hasActorByTypeName(actorTypeName, actorId);
    } catch (error) {
      return false;
    }
  }

  public hasActorByTypeName(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.has(actorId);
  }

  async invoke<TActorInterface, TResult>(
    actorTypeName: string,
    actorId: string,
    methodName: string,
    payload: any,
  ): Promise<TResult> {
    const manager = this.getActorManager<TActorInterface>(actorTypeName);
    const requestBody = JSON.stringify(payload);
    return await manager.invoke(new ActorId(actorId), methodName, Buffer.from(requestBody));
  }

  async removeInstance(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.delete(actorId);
  }
}
