import { DaprClient, DaprClientOptions } from '@dapr/dapr';
import ActorClient from '@dapr/dapr/actors/client/ActorClient/ActorClient';
import StateProvider from '@dapr/dapr/actors/runtime/StateProvider';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DaprClientCache {
  private static clients = new Map<string, DaprClient>();
  private static actorClients = new Map<string, ActorClient>();
  private static stateProviders = new Map<string, StateProvider>();

  static getDaprClient(): DaprClient | undefined {
    if (this.clients.size === 0) return undefined;
    return this.clients.entries().next().value[1];
  }

  static getAllClients(): DaprClient[] {
    return Array.from(this.clients.values());
  }

  static getAllActorClients(): ActorClient[] {
    return Array.from(this.actorClients.values());
  }

  static getAllStateProviders(): StateProvider[] {
    return Array.from(this.stateProviders.values());
  }

  static getClientByHost(host: string): DaprClient | undefined {
    return this.clients.get(host);
  }

  static getActorClientByHost(host: string): ActorClient | undefined {
    return this.actorClients.get(host);
  }

  static getStateProviderByHost(host: string): StateProvider | undefined {
    return this.stateProviders.get(host);
  }

  static getOrCreateActorClientFromClient(daprClient: DaprClient): ActorClient {
    if (this.actorClients.has(daprClient.options.daprHost)) {
      return this.actorClients.get(daprClient.options.daprHost);
    }

    // If the client is not known cache it as well
    if (!this.clients.has(daprClient.options.daprHost)) {
      this.clients.set(daprClient.options.daprHost, daprClient);
    }

    return this.getOrCreateActorClientFromOptions(daprClient.options);
  }
  static getOrCreateStateProviderFromOptions(options: DaprClientOptions) {
    if (this.stateProviders.has(options.daprHost)) {
      return this.stateProviders.get(options.daprHost);
    }
    const actorClient = this.getOrCreateActorClientFromOptions(options);
    const stateProvider = new StateProvider(actorClient);
    this.stateProviders.set(options.daprHost, stateProvider);
    return stateProvider;
  }

  static getOrCreateActorClientFromOptions(options: DaprClientOptions): ActorClient {
    if (this.actorClients.has(options.daprHost)) {
      return this.actorClients.get(options.daprHost);
    }
    const client = new ActorClient(options.daprHost, options.daprPort, options.communicationProtocol, options);
    this.actorClients.set(options.daprHost, client);
    return client;
  }

  static getOrCreateClientFromOptions(options: DaprClientOptions): DaprClient {
    if (this.clients.has(options.daprHost)) {
      return this.clients.get(options.daprHost);
    }
    const client = new DaprClient(options);
    this.clients.set(options.daprHost, client);
    return client;
  }
}
