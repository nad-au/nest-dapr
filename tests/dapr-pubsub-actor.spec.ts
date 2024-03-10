import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { sleep, waitForArrayLengthToBe } from './test.utils';
import { DaprActorClient, DaprPubSubClient } from '../lib';
import { StatelessPubSubActorInterface } from './src/stateless-pubsub.actor';
import { DaprEventEmitter } from '../lib/dapr-event-emitter.service';

// To run inside Dapr use:
// dapr run --app-id nest-dapr --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test -- pubsub
describe('DaprPubSubActor', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let daprServer: DaprServer;
  let daprClient: DaprClient;
  let pubsubClient: DaprPubSubClient;
  let daprActorClient: DaprActorClient;
  let daprEventEmitter: DaprEventEmitter;

  const runId = randomUUID();
  let messages = [];

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
    daprActorClient = testingModule.get(DaprActorClient);
    daprEventEmitter = testingModule.get(DaprEventEmitter);
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
        const eventName = data.type ?? data.eventName ?? data.event ?? data.topic;
        const results = await daprEventEmitter.emitAsync(eventName, data);
        // If results are undefined, then we should retry (either no subscribers or an error)
        if (results === undefined) {
          return DaprPubSubStatusEnum.RETRY;
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
    messages = [];
    expect(messages.length).toEqual(0);
  });

  describe('PubSub', () => {
    it('should publish an event', async () => {
      const message = {
        type: 'com.example.event',
        producerId: 'test-1',
        id: randomUUID(),
        time: new Date().toISOString(),
        run: runId,
      };
      await pubsubClient.publish('message-1', 'test-1', 'events', message);
      await waitForArrayLengthToBe(messages, 1);
      expect(messages.length).toEqual(1);

      // The actor should have received the message
      await sleep(250, 4);

      const actor = daprActorClient.getActor(StatelessPubSubActorInterface, 'test-1');
      const actorMessages = await actor.getMessages();
      expect(actorMessages.length).toEqual(3);
    });
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
  });
});
