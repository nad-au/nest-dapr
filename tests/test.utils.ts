/**
 * Sleeps for a given number of milliseconds.
 * This is useful when testing and for waiting for asynchronous operations to complete.
 */
export async function sleep(
  milliseconds: number = 1000,
  numberOfTimes: number = 1,
): Promise<void> {
  // Sleep for n number of times
  for (let i = 0; i < numberOfTimes; i++) {
    const sleepPromise = new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
      // Allow the process to complete its current tick cycle
      // See https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick#process-nexttick
      process.nextTick(() => {});
    });
    await sleepPromise;
  }
}
