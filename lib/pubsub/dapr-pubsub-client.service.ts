import { randomUUID } from 'crypto';
import { DaprClient } from '@dapr/dapr';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Subject, Subscription, toArray } from 'rxjs';
import { bufferTime } from 'rxjs/operators';
import { PublishMessage } from './publish.message';

@Injectable()
export class DaprPubSubClient implements OnApplicationShutdown {
  private readonly logger = new Logger(DaprPubSubClient.name);

  private defaultName = 'pubsub';
  private subscription: Subscription;
  private readonly buffer: Subject<PublishMessage> = new Subject<PublishMessage>();
  private readonly bufferSize: number = 10; // in messages
  private readonly bufferTimeSpan: number = 1000; // in milliseconds
  private onError: (messages: PublishMessage[], error: Error) => void;

  constructor(private readonly daprClient: DaprClient) {
    this.setupBufferSubscription();
  }

  setDefaultName(name: string) {
    this.defaultName = name;
  }

  registerErrorHandler(handler: (messages: PublishMessage[], error: Error) => void) {
    this.onError = handler;
  }

  protected async handleError(messages: PublishMessage[], error: Error) {
    this.logger.error(`Error publishing ${messages.length ? 'message' : 'messages'} to pubsub`, error);
    if (this.onError) {
      await this.onError(messages, error);
    }
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

  protected setupBufferSubscription() {
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

  protected async publishBulkDirectly(messages: PublishMessage[]) {
    // If there is only one message, we can publish it directly
    if (messages.length === 1) {
      const message = messages[0];
      await this.publishDirectly(
        message.id,
        message.name,
        message.topic,
        message.payload,
        message.producerId,
        message.metadata,
        false,
        message.contentType,
      );
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
        await this.publishDirectly(
          name,
          topic,
          messages[0].payload,
          producerId,
          messages[0].metadata,
          false,
          messages[0].contentType,
        );
        continue;
      }
      try {
        const contentType = messages[0].contentType ?? 'application/json';
        const response = await this.daprClient.pubsub.publishBulk(
          name,
          topic,
          messages.map((m) => m.payload),
          producerId ? { metadata: { partitionKey: producerId }, contentType } : undefined,
        );
        if (response !== undefined && response.failedMessages && response.failedMessages.length > 0) {
          const error = response.failedMessages[0]?.error ?? new Error('Unable to publish message');
          const failedMessages = response.failedMessages.map((m, i) => {
            const messageId = this.getMessageId(m.message.event, m.message.entryID);
            return {
              id: messageId,
              name,
              topic,
              payload: m.message.event,
              metadata: m.message.metadata,
              contentType: m.message.contentType ?? contentType,
            };
          });
          await this.handleError(failedMessages, error);
        }
      } catch (error) {
        await this.handleError(messages, error);
      }
    }
  }

  protected async publishDirectly(
    id: string,
    name: string,
    topic: string,
    payload: any,
    producerId?: string,
    metadata?: any,
    fireAndForget = false,
    contentType?: string,
  ) {
    try {
      if (!name) name = this.defaultName;
      if (!contentType) contentType = 'application/json';
      // Fire and forget will run the publish operation without waiting for a response (in a setTimeout)
      const options = {
        contentType,
      };
      if (metadata) {
        options['metadata'] = metadata;
      }
      if (producerId) {
        // Merge the partitionKey into the metadata if it exists, otherwise create a new metadata object
        options['metadata'] = { partitionKey: producerId, ...metadata };
      }

      if (fireAndForget) {
        setTimeout(async () => {
          // This will run in the background and not await a response
          try {
            const response = await this.daprClient.pubsub.publish(name, topic, payload, options);
            if (response !== undefined && response.error) {
              throw response.error;
            }
          } catch (error) {
            await this.handleError([{ id: id ?? randomUUID(), producerId, name, topic, payload, metadata }], error);
            return false;
          }
        });
        return true;
      }

      // This will await the sidecar response
      const response = await this.daprClient.pubsub.publish(name, topic, payload, options);
      if (response !== undefined && response.error) {
        throw response.error;
      }
      return true;
    } catch (error) {
      await this.handleError([{ id: id ?? randomUUID(), producerId, name, topic, payload, metadata }], error);
      return false;
    }
  }

  async publish(
    id: string,
    name: string,
    producerId: string,
    topic: string,
    payload: any,
    buffer: boolean,
    metadata?: any,
    contentType?: string,
  ): Promise<boolean>;
  async publish(
    id: string,
    producerId: string,
    topic: string,
    payload: any,
    buffer: boolean,
    metadata?: any,
    contentType?: string,
  ): Promise<boolean>;
  async publish(id: string, producerId: string, topic: string, payload: any): Promise<boolean>;
  // Implementation that covers both overloads
  async publish(
    ...args:
      | [string, string, string, string, any, boolean, any?, string?]
      | [string, string, string, any, string?]
      | [string, string, string, any, boolean, any?, string?]
  ) {
    let id: string;
    let name: string;
    let producerId: string;
    let topic: string;
    let payload: any;
    let buffer: boolean;
    let metadata: any;
    let contentType: string;

    if (args.length === 8) {
      [id, name, producerId, topic, payload, buffer, metadata, contentType] = args;
    } else {
      [id, producerId, topic, payload, buffer, metadata, contentType] = args;
      name = this.defaultName;
    }
    if (!name) name = this.defaultName;
    if (!contentType) contentType = 'application/json';

    // If we are buffering messages (default), they will be published in bulk by a rxjs buffer
    if (buffer === undefined || buffer) {
      this.buffer.next({ id: id ?? randomUUID(), name, producerId, topic, payload, metadata, contentType });
      return;
    }

    // Publish directly
    return await this.publishDirectly(
      id ?? randomUUID(),
      name,
      topic,
      payload,
      producerId,
      metadata,
      true,
      contentType,
    );
  }

  async publishBulk(
    name: string,
    producerId: string,
    topic: string,
    payloads: any[],
    metadata?: any,
    contentType?: string,
  ): Promise<boolean>;
  async publishBulk(
    producerId: string,
    topic: string,
    payloads: any[],
    metadata?: any,
    contentType?: string,
  ): Promise<boolean>;
  async publishBulk(producerId: string, topic: string, payloads: any[]): Promise<boolean>;
  async publishBulk(
    ...args:
      | [string, string, string, any[], any?, string?]
      | [string, string, any[], any?, string?]
      | [string, string, any[]]
  ) {
    let name: string;
    let producerId: string;
    let topic: string;
    let payloads: any[];
    let metadata: any;
    let contentType: string;

    if (args.length === 6) {
      [name, producerId, topic, payloads, metadata, contentType] = args;
    } else if (args.length === 5) {
      [producerId, topic, payloads, metadata, contentType] = args as [string, string, any[], any?, string?];
      name = this.defaultName;
    } else {
      [producerId, topic, payloads] = args as [string, string, any[]];
      name = this.defaultName;
    }
    if (!name) name = this.defaultName;
    if (!contentType) contentType = 'application/json';

    // If there is only one message, we can publish it directly
    if (payloads.length === 1) {
      const messageId = this.getMessageId(payloads[0]);
      return await this.publishDirectly(messageId, name, topic, payloads[0], producerId, metadata, true, contentType);
    }
    for (const payload of payloads) {
      this.buffer.next({
        id: this.getMessageId(payloads),
        name,
        producerId,
        topic,
        payload,
        metadata,
        contentType,
      });
    }
    return true;
  }

  private getMessageId(payload: any, defaultValue?: string): string {
    return payload.id ?? payload.messageId ?? payload.correlationId ?? defaultValue ?? randomUUID();
  }
}
