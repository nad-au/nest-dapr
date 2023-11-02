import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache: Map<string, any> = new Map();

  public async get<T>(key: string): Promise<T> {
    return this.cache.get(key);
  }

  public async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
  }

  public async increment<T>(key: string): Promise<void> {
    const value = this.cache.get(key) ?? 0;
    this.cache.set(key, value + 1);
  }

  public async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}
