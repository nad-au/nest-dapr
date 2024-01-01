import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Mediator } from './mediator/mediator.service';
import { IncrementCounterCommand } from './counter/increment-counter.command';
import { GetCounterValueQuery } from './counter/get-counter-value.query';

@Controller('counter')
export class CounterController {
  constructor(private mediator: Mediator) {}

  @Post(':id/increment')
  @HttpCode(200)
  async increment(@Param('id') id: string): Promise<number> {
    return await this.mediator.execute(new IncrementCounterCommand(id));
  }

  @Get(':id')
  @HttpCode(200)
  async get(@Param('id') id: string): Promise<number> {
    return await this.mediator.query(new GetCounterValueQuery(id));
  }
}
