import { DaprModule } from '@dbc-tech/nest-dapr';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [DaprModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
