import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { StatelessCounterActorInterface } from './src/stateless-counter.actor';
import { DaprActorClient } from '../lib/actors/dapr-actor-client.service';

// To run inside Dapr use:
// dapr run --app-id nest-dapr --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test
describe('DaprActor', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let daprServer: DaprServer;
  let daprClient: DaprClient;
  let daprActorClient: DaprActorClient;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    daprServer = app.get<DaprServer>(DaprServer);
    daprClient = testingModule.get(DaprClient);
    daprActorClient = testingModule.get(DaprActorClient);

    expect(daprClient).toBeDefined();
    expect(daprActorClient).toBeDefined();
  });

  describe('callActor', () => {
    it('should call an actor and return a serializable error', async () => {
      const actor = daprActorClient.getActor(StatelessCounterActorInterface, 'stateless-1');
      const initialValue: any = await actor.throwSerializableError();
      expect(initialValue).toBeDefined();
      expect(initialValue.message).toBe('This is a serializable error');
    });

    it('should call an actor and it should throw an error', async () => {
      const actor = daprActorClient.getActor(StatelessCounterActorInterface, 'stateless-1');
      try {
        const initialValue = await actor.throwError();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
  });
});
