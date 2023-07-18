import { DaprModule } from '@dbc-tech/nest-dapr';
import { Module } from '@nestjs/common';
import { PubsubController } from './pubsub.controller';
import { CommunicationProtocolEnum } from '@dapr/dapr';

@Module({
  imports: [
    DaprModule.register({
      serverPort: process.env.DAPR_SERVER_PORT,
      clientOptions: {
        daprPort: process.env.DAPR_PORT,
        daprHost: 'localhost',
        communicationProtocol: CommunicationProtocolEnum.HTTP,
      },
    }),
  ],
  controllers: [PubsubController],
})
export class AppModule {}
