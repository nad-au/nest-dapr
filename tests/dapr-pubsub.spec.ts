import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { sleep, waitForArrayLengthToBe } from './test.utils';
import { DaprPubSubClient } from '../lib';

// To run inside Dapr use:
// dapr run --app-id nest-dapr --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test -- pubsub
describe('DaprPubSub', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let daprServer: DaprServer;
  let daprClient: DaprClient;
  let pubsubClient: DaprPubSubClient;

  const runId = randomUUID();
  let messages = [];
  let handlerFn: (data: any) => Promise<DaprPubSubStatusEnum>;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    daprServer = app.get<DaprServer>(DaprServer);
    daprClient = testingModule.get(DaprClient);
    pubsubClient = testingModule.get(DaprPubSubClient);
    expect(daprClient).toBeDefined();
    expect(pubsubClient).toBeDefined();

    // Subscribe to the pubsub events
    await daprServer.pubsub.subscribe('pubsub', 'events', async (data: any) => {
      console.log('Received message', data);
      if (data.run !== runId) {
        // This must be a message from a previous test run
        return DaprPubSubStatusEnum.SUCCESS;
      }
      messages.push(data);
      try {
        if (handlerFn) {
          return handlerFn(data);
        }
      } catch (e) {
        return DaprPubSubStatusEnum.RETRY;
      }
      return DaprPubSubStatusEnum.SUCCESS;
    });
    // Drain any previous messages
    await sleep(500, 2);
  });

  beforeEach(() => {
    handlerFn = undefined;
    messages = [];
    expect(messages.length).toEqual(0);
  });

  describe('PubSub', () => {
    it('should publish an event', async () => {
      const message = { type: 'event', id: randomUUID(), time: new Date().toISOString(), run: runId };
      await pubsubClient.publish('pubsub', 'test-1', 'events', message);
      await waitForArrayLengthToBe(messages, 1);
      expect(messages.length).toEqual(1);
    });

    it('should publish an event, and it should fail to process 3 times', async () => {
      handlerFn = async (data: any) => {
        const firstMessageAttempts = messages.filter((m) => m.id === 1).length;
        if (data.id === 1 && firstMessageAttempts < 3) {
          return DaprPubSubStatusEnum.RETRY;
        }
        return DaprPubSubStatusEnum.SUCCESS;
      };
      const firstMessage = {
        type: 'event',
        id: 1,
        time: new Date().toISOString(),
        run: runId,
      };
      await pubsubClient.publish('pubsub', 'test-2', 'events', firstMessage);

      // Wait for the array to contain 4 messages
      await waitForArrayLengthToBe(messages, 3);
      expect(messages.length).toBeGreaterThan(2);

      const secondMessage = {
        type: 'event',
        id: 2,
        time: new Date().toISOString(),
        run: runId,
      };
      await pubsubClient.publish('pubsub', 'test-2', 'events', secondMessage);
      await waitForArrayLengthToBe(messages, 4);
      // We expect 4 messages, as the first message should be processed 3 times
      expect(messages.length).toEqual(4);
    }, 60000);

    it('should publish an event, and it should fail to process', async () => {
      handlerFn = async (data: any) => {
        return DaprPubSubStatusEnum.RETRY;
      };
      const firstMessage = {
        type: 'event',
        id: 3,
        time: new Date().toISOString(),
        run: runId,
      };
      await pubsubClient.publish('pubsub', 'test-3', 'events', firstMessage);
      // The retry policy is 3 times, so the total messages should be 4 (1+3 retries)
      await waitForArrayLengthToBe(messages, 4);
      expect(messages.length).toBeGreaterThan(3);
      expect(messages.length).toBeLessThan(10);
      // All the received messages should be the same original message
      expect(messages.every((m) => m.id === firstMessage.id)).toBeTruthy();
      // Wait another 5 seconds to ensure no more messages are received
      await sleep(5000);
      expect(messages.length).toBeGreaterThan(3);
      expect(messages.length).toBeLessThan(10);
    }, 60000);
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
  });
});
