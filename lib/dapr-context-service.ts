import { Injectable } from '@nestjs/common';
import { ClsService, ClsServiceManager } from 'nestjs-cls';

export const DAPR_CONTEXT_KEY = 'context';

@Injectable()
export class DaprContextService {
  constructor(private readonly cls: ClsService) {}

  getService(): ClsService {
    // See https://papooch.github.io/nestjs-cls/features-and-use-cases/breakin-out-of-di
    return this.cls ?? ClsServiceManager.getClsService();
  }

  setByKey<T>(key: string, value: T) {
    this.getService().set(key, value);
  }
  set<T>(value: T) {
    this.setByKey(DAPR_CONTEXT_KEY, value);
  }

  getByKey<T>(key: string): T | undefined {
    try {
      return (this.getService().get<T>(key) as T) ?? undefined;
    } catch (error) {
      // We don't want to throw an error if the context key is not set.
      return undefined;
    }
  }

  get<T>(): T | undefined {
    try {
      return this.getByKey<T>(DAPR_CONTEXT_KEY);
    } catch (error) {
      // We don't want to throw an error if the context is not set.
      return undefined;
    }
  }
}
