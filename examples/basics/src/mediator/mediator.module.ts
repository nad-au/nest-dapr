import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Mediator } from './mediator.service';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [Mediator],
  exports: [Mediator],
})
export class MediatorModule {}
