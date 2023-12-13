import { Module } from '@nestjs/common';
import { PubsubController } from './pubsub.controller';
import { CommunicationProtocolEnum, DaprPubSubStatusEnum } from '@dapr/dapr';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DaprModule } from '@rayondigital/nest-dapr';
import { CounterController } from './counter.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { CounterModule } from './counter/counter.module';
import { ActorModule } from './actors/actor.module';
import { MediatorModule } from './mediator/mediator.module';

@Module({
  imports: [
    CqrsModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    DaprModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        return {
          onError: () => DaprPubSubStatusEnum.RETRY,
          serverHost: configService.get('DAPR_SERVER_HOST'),
          serverPort: configService.get('DAPR_SERVER_PORT'),
          daprHost: configService.get('DAPR_HOST'),
          daprPort: configService.get('DAPR_PORT'),
          actorOptions: {
            prefix:
              configService.get('NAMESPACE') ??
              configService.get('DAPR_ACTOR_PREFIX'),
          },
          clientOptions: {
            daprHost: configService.get('DAPR_HOST'),
            daprPort: configService.get('DAPR_PORT'),
            communicationProtocol:
              configService.get('DAPR_COMMUNICATION_PROTOCOL') ??
              CommunicationProtocolEnum.HTTP,
            actor: {
              reentrancy: {
                enabled: true,
                maxStackDepth: 6,
              },
              actorIdleTimeout: '1m',
              actorScanInterval: '30s',
            },
          },
          communicationProtocol:
            configService.get('DAPR_COMMUNICATION_PROTOCOL') ??
            CommunicationProtocolEnum.HTTP,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    MediatorModule,
    ActorModule,
    CounterModule,
  ],
  controllers: [PubsubController, CounterController],
})
export class AppModule {}
