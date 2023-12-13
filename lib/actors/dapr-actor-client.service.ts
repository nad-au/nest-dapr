import { ActorId, DaprClient } from '@dapr/dapr';
import Class from '@dapr/dapr/types/Class';
import { Injectable, Type } from '@nestjs/common';
import { ActorProxyBuilder } from './actor-proxy-builder';

@Injectable()
export class DaprActorClient {
  // Keys are the actor type names in lower case and values are the actor client builders
  private actorClients: Map<string, ActorProxyBuilder<any>> = new Map();
  // Keys are the actor type names in lower case and values are the actor types / interfaces
  private interfaces: Map<string, Type<any> | Function> = new Map();
  // Keys are the interface name in lower case and values are the actor type names in lower case
  private interfaceToActorTypeNames: Map<string, string> = new Map();
  private prefix = '';
  private delimiter = '-';
  private typeNamePrefix = '';

  constructor(private readonly daprClient: DaprClient) {}

  setPrefix(prefix: string, delimiter = '-'): void {
    this.prefix = prefix;
    this.delimiter = delimiter;
  }

  setTypeNamePrefix(prefix: string): void {
    this.typeNamePrefix = prefix;
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
    const actorTypeName = actorType.name ?? actorType.constructor.name;
    this.interfaceToActorTypeNames.set(interfaceTypeName, actorTypeName);
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
    const typeName = actorType.name ?? actorType.constructor.name;
    // Resolve the actor type name from the interface type name/or actor type name
    const actorTypeName = this.getActorTypeName(typeName);

    if (!actorTypeName) {
      throw new Error(`Actor type name must be provided`);
    }
    if (!this.contains(actorTypeName)) {
      throw new Error(`Actor ${actorTypeName} not found`);
    }
    const fullActorId = this.getActorId(actorId);
    const actorClient = this.getActorClient<TActorInterface>(actorTypeName);
    return actorClient.build(fullActorId, actorTypeName);
  }

  getActorByTypeName<TActorInterface>(
    actorTypeName: string,
    actorId: string,
  ): TActorInterface {
    if (this.interfaceToActorTypeNames.has(actorTypeName)) {
      actorTypeName = this.interfaceToActorTypeNames.get(actorTypeName);
    }
    if (!actorTypeName) {
      throw new Error(`Actor type name must be provided`);
    }
    if (!this.contains(actorTypeName)) {
      throw new Error(`Actor ${actorTypeName} not found`);
    }

    const fullActorId = this.getActorId(actorId);
    const actorClient = this.getActorClient<TActorInterface>(actorTypeName);
    return actorClient.build(fullActorId, actorTypeName) as TActorInterface;
  }

  getActorTypeName(typeName: string): string {
    // The input could be an interface so look up the actor type name
    if (this.interfaceToActorTypeNames.has(typeName)) {
      const actorTypeName = this.interfaceToActorTypeNames.get(typeName);
      if (this.actorClients.has(actorTypeName)) {
        return actorTypeName;
      } else {
        return `${this.typeNamePrefix}${actorTypeName}`;
      }
    }
    // If a prefix is required use it
    if (this.typeNamePrefix) {
      return `${this.typeNamePrefix}${typeName}`;
    }
    return typeName;
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
