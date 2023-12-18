import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DaprActorClient } from '../lib/actors/dapr-actor-client.service';
import { ContextAwareActorInterface } from './src/context-aware.actor';
import { DaprContextService } from '../lib';
import { itWithContext } from './test.utils';

// To run inside Dapr use:
// dapr run --app-id nest-dapr-test --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test
describe('DaprActorContext', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let contextService: ClsService;
  let daprClient: DaprClient;
  let daprActorClient: DaprActorClient;
  let daprContextService: DaprContextService;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    contextService = app.get<ClsService>(ClsService);
    daprClient = testingModule.get(DaprClient);
    daprActorClient = testingModule.get(DaprActorClient);
    daprContextService = testingModule.get(DaprContextService);

    expect(contextService).toBeDefined();
    expect(daprClient).toBeDefined();
    expect(daprActorClient).toBeDefined();
    expect(daprContextService).toBeDefined();
  });

  describe('callContextAwareActor', () => {
    itWithContext(
      'should call a context aware actor',
      contextService,
      async () => {
        const context = {
          correlationID: '2ed1cf54-7544-4c7e-bbb8-85cce8c8090f',
          userID: 'user-1',
          tenantID: 'tenant-1',
        };
        daprContextService.set(context);
        expect(daprContextService.get()).toBe(context);

        const actor1 = daprActorClient.getActor(
          ContextAwareActorInterface,
          'context-1',
        );

        const correlationID = await actor1.run();
        expect(correlationID).toBe(context.correlationID);

        // Call another actor
        const actor2 = daprActorClient.getActor(
          ContextAwareActorInterface,
          'context-2',
        );
        const correlationID2 = await actor2.run();
        expect(correlationID2).toBe(context.correlationID);
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
