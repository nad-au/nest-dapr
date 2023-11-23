import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

export class ExternalCommand {
  constructor(public readonly id: string) {}
}

export class ExternalCommandResult {
  id: string;
}

@CommandHandler(ExternalCommand)
export class ExternalCommandHandler
  implements ICommandHandler<ExternalCommand, ExternalCommandResult>
{
  private readonly logger = new Logger(ExternalCommandHandler.name);

  async execute(command: ExternalCommand): Promise<ExternalCommandResult> {
    // Talk to the database or use some other Nest dependency
    return { id: '123' };
  }
}
