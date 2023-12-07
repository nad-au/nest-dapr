import { CommunicationProtocolEnum, LogLevel } from '@dapr/dapr';
import { Module } from '@nestjs/common';
import { DaprModule } from '../../lib';
import { StatelessCounterActor } from '../src/stateless-counter.actor';
import { CounterActor } from '../src/counter.actor';
import { CacheService } from '../src/cache.service';
import { CounterController } from './counter.controller';

@Module({
  imports: [
    DaprModule.register({
      serverHost: '127.0.0.1',
      serverPort: process.env.PORT ?? '3001',
      communicationProtocol: CommunicationProtocolEnum.HTTP,
      clientOptions: {
        daprHost: '127.0.0.1',
        daprPort: process.env.DAPR_PORT ?? '3500',
        communicationProtocol: CommunicationProtocolEnum.HTTP,
        logger: {
          level: LogLevel.Verbose,
        },
      },
      actorOptions: {
        prefix: 'test',
        typeNamePrefix: 'Test',
      },
    }),
  ],
  controllers: [CounterController],
  providers: [CacheService, StatelessCounterActor, CounterActor],
})
export class TestModule {}
