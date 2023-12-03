import { ActorId, ActorProxyBuilder, DaprClient } from '@dapr/dapr';
import Class from '@dapr/dapr/types/Class';
import { Injectable, Type } from '@nestjs/common';

@Injectable()
export class DaprActorClient {
  // Keys are the actor type names in lower case and values are the actor client builders
  private actorClients: Map<string, ActorProxyBuilder<any>> = new Map();
  // Keys are the actor type names in lower case and values are the actor types / interfaces
  private interfaces: Map<string, Type<any> | Function> = new Map();
  private prefix = '';
  private delimiter = '-';

  constructor(private readonly daprClient: DaprClient) {}

  setPrefix(prefix: string, delimiter = '-'): void {
    this.prefix = prefix;
    this.delimiter = delimiter;
  }

  register<T>(
    actorTypeName: string,
    actorType: Type<T> | Function,
    daprClient?: DaprClient,
  ): void {
    this.interfaces.set(this.formatActorTypeName(actorTypeName), actorType);
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
    this.interfaces.set(this.formatActorTypeName(interfaceTypeName), actorType);
    this.actorClients.set(
      this.formatActorTypeName(interfaceTypeName),
      new ActorProxyBuilder<T>(
        actorType as Class<T>,
        daprClient ?? this.daprClient,
      ),
    );
  }

  getActorId(actorId: string): ActorId {
    if (this.prefix) {
      return new ActorId(`${this.prefix}${this.delimiter ?? '-'}${actorId}`);
    }
    return new ActorId(actorId);
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
    const fullActorId = this.getActorId(actorId);
    return actorClient.build(fullActorId);
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
    const fullActorId = this.getActorId(actorId);
    return actorClient.build(fullActorId) as TActorInterface;
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
