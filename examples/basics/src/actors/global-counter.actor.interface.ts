export abstract class GlobalCounterActorInterface {
  abstract increment(): Promise<number>;
  abstract getCounter(): Promise<number>;
}
