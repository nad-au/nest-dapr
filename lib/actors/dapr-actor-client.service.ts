import { ActorId, ActorProxyBuilder, DaprClient } from '@dapr/dapr';
import Class from '@dapr/dapr/types/Class';
import { Injectable, Type } from '@nestjs/common';

@Injectable()
export class DaprActorClient {
  // Keys are the actor type names in lower case and values are the actor client builders
  private actorClients: Map<string, ActorProxyBuilder<any>> = new Map();

  constructor(private readonly daprClient: DaprClient) {}

  register<T>(
    actorTypeName: string,
    actorType: Type<T> | Function,
    daprClient?: DaprClient,
  ): void {
    this.actorClients.set(
      this.formatActorTypeName(actorTypeName),
      new ActorProxyBuilder<T>(
        actorType as Class<T>,
        daprClient ?? this.daprClient,
      ),
    );
  }

  registerInterface<T>(
    actorType: Type<T> | Function,
    interfaceType: Type<T> | Function,
    daprClient?: DaprClient,
  ): void {
    const interfaceTypeName =
      interfaceType.name ?? interfaceType.constructor.name;
    this.actorClients.set(
      this.formatActorTypeName(interfaceTypeName),
      new ActorProxyBuilder<T>(
        actorType as Class<T>,
        daprClient ?? this.daprClient,
      ),
    );
  }

  getActor<TActorInterface>(
    actorType: Type<TActorInterface> | Function,
    actorId: string,
  ): TActorInterface {
    const actorTypeName = actorType.name ?? actorType.constructor.name;
    if (!actorTypeName) {
      throw new Error(`Actor type name must be provided`);
    }
    if (!this.contains(actorTypeName)) {
      throw new Error(`Actor ${actorTypeName} not found`);
    }
    const actorClient = this.getActorClient<TActorInterface>(actorTypeName);
    return actorClient.build(new ActorId(actorId));
  }

  getActorByTypeName<TActorInterface>(
    actorTypeName: string,
    actorId: string,
  ): TActorInterface {
    if (!actorTypeName) {
      throw new Error(`Actor type name must be provided`);
    }
    if (!this.contains(actorTypeName)) {
      throw new Error(`Actor ${actorTypeName} not found`);
    }
    const actorClient = this.getActorClient<TActorInterface>(actorTypeName);
    return actorClient.build(new ActorId(actorId)) as TActorInterface;
  }

  contains(actorTypeName: string): boolean {
    return this.actorClients.has(this.formatActorTypeName(actorTypeName));
  }

  private formatActorTypeName(actorTypeName: string): string {
    return actorTypeName.toLowerCase();
  }

  private getActorClient<TActorInterface>(
    actorTypeName: string,
  ): ActorProxyBuilder<TActorInterface> {
    return this.actorClients.get(
      this.formatActorTypeName(actorTypeName),
    ) as ActorProxyBuilder<TActorInterface>;
  }
}
