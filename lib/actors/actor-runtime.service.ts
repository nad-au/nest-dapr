import { ActorId } from '@dapr/dapr';
import ActorRuntime from '@dapr/dapr/actors/runtime/ActorRuntime';
import { Injectable } from '@nestjs/common';
import ActorManager from '@dapr/dapr/actors/runtime/ActorManager';

@Injectable()
export class ActorRuntimeService {
  // Returns the current actor runtime instance for this process
  public getRuntime() {
    return ActorRuntime['instance'] as ActorRuntime;
  }

  // Returns the actor manager for the given actor type name
  public getActorManager<TActorInterface>(actorTypeName: string) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.getRuntime().getActorManager<TActorInterface>(actorTypeName);
  }

  public getAllActors(): Map<string, any> {
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

  public getActors<TActorInterface>(actorTypeName: string) {
    const manager = this.getActorManager<TActorInterface>(actorTypeName);
    return manager.actors;
  }

  public getActor<TActorInterface>(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.get(actorId) as TActorInterface;
  }

  public hasActor(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.has(actorId);
  }

  public async invoke<TActorInterface, TResult>(
    actorTypeName: string,
    actorId: string,
    methodName: string,
    payload: any,
  ): Promise<TResult> {
    const manager = this.getActorManager<TActorInterface>(actorTypeName);
    const requestBody = JSON.stringify(payload);
    return await manager.invoke(new ActorId(actorId), methodName, Buffer.from(requestBody));
  }

  public async removeInstance(actorTypeName: string, actorId: string) {
    const manager = this.getActorManager(actorTypeName);
    return manager.actors.delete(actorId);
  }
}
