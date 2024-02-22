import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { sleep } from './test.utils';

// To run inside Dapr use:
// dapr run --app-id nest-dapr --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test -- pubsub
describe('DaprPubSub', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let daprServer: DaprServer;
  let daprClient: DaprClient;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    daprServer = app.get<DaprServer>(DaprServer);
    daprClient = testingModule.get(DaprClient);
    expect(daprClient).toBeDefined();
  });

  describe('PubSub', () => {
    it('should publish an event', async () => {
      let lastMessage: any;
      await daprServer.pubsub.subscribe('redis-pubsub', 'events', async (data: any) => {
        lastMessage = data;
      });
      const message = { timestamp: new Date().toISOString() };
      await daprClient.pubsub.publish('redis-pubsub', 'events', message, {
        metadata: {
          source: 'test',
        },
      });
      await sleep(250, 4);
      expect(lastMessage).toBeDefined();
      expect(lastMessage).toEqual(message);
    });
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
  });
});
