import { DaprClient } from '@dapr/dapr';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { PubsubController } from './pubsub.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: PubsubController;
  const daprMock: DeepMocked<DaprClient> = createMock<DaprClient>();

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PubsubController],
      providers: [
        AppService,
        {
          provide: DaprClient,
          useValue: daprMock,
        },
      ],
    }).compile();

    appController = app.get<PubsubController>(PubsubController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
