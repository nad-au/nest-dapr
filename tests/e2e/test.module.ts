import { CommunicationProtocolEnum, LogLevel } from '@dapr/dapr';
import { Module } from '@nestjs/common';
import { DaprModule } from '../../lib';
import { StatelessCounterActor } from '../src/stateless-counter.actor';
import { CounterActor } from '../src/counter.actor';
import { CacheService } from '../src/cache.service';
import { CounterController } from './counter.controller';
import { ContextAwareActor } from '../src/context-aware.actor';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
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
        actor: {
          reentrancy: {
            enabled: true,
            maxStackDepth: 32,
          },
          actorIdleTimeout: '30s',
          actorScanInterval: '30s',
        },
      },
      actorOptions: {
        prefix: 'test',
        typeNamePrefix: 'Test',
      },
    }),
  ],
  controllers: [CounterController],
  providers: [
    CacheService,
    StatelessCounterActor,
    CounterActor,
    ContextAwareActor,
  ],
})
export class TestModule {}
