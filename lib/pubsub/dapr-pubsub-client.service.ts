import { DaprClient } from '@dapr/dapr';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Subject, Subscription, toArray } from 'rxjs';
import { bufferTime } from 'rxjs/operators';
import { DAPR_MODULE_OPTIONS_TOKEN, DaprModuleOptions } from '../dapr.module';
import { PublishMessage } from './publish.message';

@Injectable()
export class DaprPubSubClient implements OnApplicationShutdown {
  private readonly defaultName: string;
  private readonly buffer: Subject<PublishMessage> = new Subject<PublishMessage>();
  private subscription: Subscription;
  private readonly bufferSize: number = 10; // in messages
  private readonly bufferTimeSpan: number = 1000; // in milliseconds
  constructor(
    @Inject(DAPR_MODULE_OPTIONS_TOKEN)
    private readonly options: DaprModuleOptions,
    private readonly daprClient: DaprClient,
  ) {
    this.defaultName = this.options.pubsubOptions?.defaultName ?? 'pubsub';
    // this.defaultName = 'pubsub';
    this.setupBufferSubscription();
  }

  async onApplicationShutdown(signal?: string) {
    // We need to flush the buffer before shutting down
    this.subscription.unsubscribe();

    // Convert the existing messages in the buffer to a promise and await their bulk publishing
    // In this case we are using a promise to ensure the flushing process is completed before shutdown
    const flushPromise = new Promise<void>((resolve, reject) => {
      // Collect all messages currently in the buffer
      const messages: PublishMessage[] = [];
      this.buffer.pipe(toArray()).subscribe({
        next: (msgs) => messages.push(...msgs),
        error: reject,
        complete: async () => {
          try {
            await this.publishBulkDirectly(messages);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      });

      // Complete the buffer to trigger the toArray() operation
      this.buffer.complete();
    });

    // Await the promise to ensure the flushing process is completed before shutdown
    await flushPromise;
  }

  private setupBufferSubscription() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.subscription = this.buffer
      .pipe(bufferTime(this.bufferTimeSpan, null, this.bufferSize))
      .subscribe(async (messages) => {
        if (messages.length > 0) {
          await this.publishBulkDirectly(messages);
        }
      });
  }

  private async publishBulkDirectly(messages: PublishMessage[]) {
    // If there is only one message, we can publish it directly
    if (messages.length === 1) {
      const message = messages[0];
      await this.publishDirectly(message.name, message.topic, message.payload, message.producerId, message.metadata);
      return;
    }

    // Messages need to be grouped by pubsub name,topic and producer but the bulk publish API does not support this
    const grouped = messages.reduce((acc, message) => {
      const key = `${message.name}:${message.topic}:${message.producerId}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(message);
      return acc;
    }, {});

    for (const key in grouped) {
      const [name, topic, producerId] = key.split(':');
      const messages = grouped[key];
      // If there is only 1 message, we can publish it directly
      if (messages.length === 1) {
        await this.publishDirectly(name, topic, messages[0].payload, producerId, messages[0].metadata);
        continue;
      }
      await this.daprClient.pubsub.publishBulk(
        name,
        topic,
        messages.map((m) => m.payload),
        producerId ? { metadata: { partitionKey: producerId } } : undefined,
      );
    }
  }

  private async publishDirectly(
    name: string,
    topic: string,
    payload: any,
    producerId?: string,
    metadata?: any,
    fireAndForget = false,
  ) {
    if (!name) name = this.defaultName;
    // Fire and forget will run the publish operation without waiting for a response (in a setTimeout)
    const options = {};
    if (metadata) {
      options['metadata'] = metadata;
    }
    if (producerId) {
      // Merge the partitionKey into the metadata if it exists, otherwise create a new metadata object
      options['metadata'] = { partitionKey: producerId, ...metadata };
    }

    if (fireAndForget) {
      setTimeout(async () => {
        await this.daprClient.pubsub.publish(name, topic, payload, options);
      });
      return;
    }

    await this.daprClient.pubsub.publish(name, topic, payload, options);
  }

  async publish(
    name: string,
    producerId: string,
    topic: string,
    payload: any,
    buffer: boolean,
    metadata?: any,
  ): Promise<void>;
  async publish(producerId: string, topic: string, payload: any, buffer: boolean, metadata?: any): Promise<void>;
  async publish(producerId: string, topic: string, payload: any): Promise<void>;
  // Implementation that covers both overloads
  async publish(
    ...args: [string, string, string, any, boolean, any?] | [string, string, any] | [string, string, any, boolean, any?]
  ) {
    let name: string;
    let producerId: string;
    let topic: string;
    let payload: any;
    let buffer: boolean;
    let metadata: any;

    if (args.length === 6) {
      [name, producerId, topic, payload, buffer, metadata] = args;
    } else {
      [producerId, topic, payload, buffer, metadata] = args;
      name = this.defaultName;
    }
    if (!name) name = this.defaultName;

    // If we are buffering messages (default), they will be published in bulk by a rxjs buffer
    if (buffer === undefined || buffer) {
      this.buffer.next({ name, producerId, topic, payload, metadata });
      return;
    }

    // Publish directly
    await this.publishDirectly(name, topic, payload, producerId, true);
  }
}
