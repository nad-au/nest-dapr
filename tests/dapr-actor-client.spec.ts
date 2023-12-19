import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { StatelessCounterActorInterface } from './src/stateless-counter.actor';
import { DaprActorClient } from '../lib/actors/dapr-actor-client.service';
import { CounterActorInterface } from './src/counter.actor';
import { CacheService } from './src/cache.service';
import { sleep } from './test.utils';

// To run inside Dapr use:
// dapr run --app-id nest-dapr --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test
describe('DaprActorClient', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let daprServer: DaprServer;
  let daprClient: DaprClient;
  let daprActorClient: DaprActorClient;
  let cacheService: CacheService;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    daprServer = app.get<DaprServer>(DaprServer);
    daprClient = testingModule.get(DaprClient);
    cacheService = testingModule.get(CacheService);
    daprActorClient = testingModule.get(DaprActorClient);

    expect(daprClient).toBeDefined();
    expect(cacheService).toBeDefined();
    expect(daprActorClient).toBeDefined();
  });

  describe('stateStore', () => {
    it('should store a single value', async () => {
      await daprClient.state.save('statestore', [
        {
          key: 'hello',
          value: 'world',
        },
      ]);
      const value = await daprClient.state.get('statestore', 'hello');
      expect(value).toBe('world');
    });
  });

  describe('callActor', () => {
    it('should call a stateless actor', async () => {
      const actor = daprActorClient.getActor(StatelessCounterActorInterface, 'stateless-1');
      const initialValue = await actor.getCounter();
      expect(initialValue).toBeDefined();

      await actor.increment();
      const firstValue = await actor.getCounter();
      expect(firstValue).toBe(initialValue + 1);
      await actor.increment();
      const secondValue = await actor.getCounter();
      expect(secondValue).toBe(initialValue + 2);
    });

    it('should call a stateful actor', async () => {
      const actor = daprActorClient.getActor(CounterActorInterface, 'stateful-1');
      const initialValue = await actor.getCounter();
      expect(initialValue).toBeDefined();

      await actor.increment();
      const firstValue = await actor.getCounter();
      expect(firstValue).toBe(initialValue + 1);
      await actor.increment();
      const secondValue = await actor.getCounter();
      expect(secondValue).toBe(initialValue + 2);
    });
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
  });
});
