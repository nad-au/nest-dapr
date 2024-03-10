import { Injectable, Logger } from '@nestjs/common';
import EventEmitter2, { OnOptions } from 'eventemitter2';

@Injectable()
export class DaprEventEmitter {
  private readonly logger = new Logger(DaprEventEmitter.name);
  private readonly eventEmitter = new EventEmitter2({
    maxListeners: 50,
    ignoreErrors: true, // This is for missing listeners, not for errors in listeners
    wildcard: true,
    verboseMemoryLeak: true,
  });

  emit(event: string, ...args: any[]) {
    this.eventEmitter.emit(event, ...args);
  }

  emitAsync(event: string, ...args: any[]) {
    return this.eventEmitter.emitAsync(event, ...args);
  }

  on(event: string | symbol | string[] | symbol[], listener: (...args: any[]) => void, options?: boolean | OnOptions) {
    this.eventEmitter.on(event, listener, options);
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.off(event, listener);
  }

  prependListener(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.prependListener(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.once(event, listener);
  }

  hasListeners(event: string) {
    return this.eventEmitter.listeners(event).length > 0;
  }

  listeners(event: string) {
    return this.eventEmitter.listeners(event);
  }

  removeAllListeners(event?: string) {
    this.eventEmitter.removeAllListeners(event);
  }
}
