export class CounterIncrementedEvent {
  constructor(public readonly id: string, public readonly value: number) {}
}
