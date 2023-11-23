export abstract class CounterActorInterface {
  abstract increment(): Promise<number>;
  abstract getCounter(): Promise<number>;
}
