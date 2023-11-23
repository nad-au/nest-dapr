import { Module } from '@nestjs/common';
import { PubsubController } from './pubsub.controller';
import { CommunicationProtocolEnum, DaprPubSubStatusEnum } from '@dapr/dapr';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DaprModule } from '@jeremycarter/nest-dapr';
import { CounterController } from './counter.controller';
import { CounterActor } from './counter.actor';
import { GlobalCounterActor } from './global.counter.actor';
import { Mediator } from './mediator.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CounterModule } from './counter/counter.module';

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
          clientOptions: {
            daprHost: configService.get('DAPR_HOST'),
            daprPort: configService.get('DAPR_PORT'),
            communicationProtocol:
              configService.get('DAPR_COMMUNICATION_PROTOCOL') ??
              CommunicationProtocolEnum.HTTP,
          },
          communicationProtocol:
            configService.get('DAPR_COMMUNICATION_PROTOCOL') ??
            CommunicationProtocolEnum.HTTP,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    CounterModule,
  ],
  providers: [Mediator, CounterActor, GlobalCounterActor],
  controllers: [PubsubController, CounterController],
})
export class AppModule {}
