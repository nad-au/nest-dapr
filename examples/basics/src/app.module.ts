import { Module } from '@nestjs/common';
import { PubsubController } from './pubsub.controller';
import { DaprPubSubStatusEnum } from '@dapr/dapr';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DaprModule } from '@dbc-tech/nest-dapr';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    DaprModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        return {
          serverPort: configService.get('DAPR_SERVER_PORT'),
          onError: () => DaprPubSubStatusEnum.RETRY,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
  ],
  controllers: [PubsubController],
})
export class AppModule {}
