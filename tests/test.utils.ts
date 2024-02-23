import { randomUUID } from 'crypto';
import { CLS_ID, ClsService, ClsServiceManager } from 'nestjs-cls';
import { ClsStore } from 'nestjs-cls/dist/src/lib/cls.options';
import { DAPR_CORRELATION_ID_KEY } from '../lib/dapr-context-service';

/**
 * Waits for an array to be populated with at least one element, or times out.
 */
export function waitForArrayToBePopulated<T>(array: T[], timeout = 60000) {
  return new Promise<boolean>((resolve) => {
    if (array.length > 0) resolve(true);

    const checkInterval = setInterval(() => {
      if (array.length > 0) {
        clearInterval(checkInterval);
        clearTimeout(failureTimeout);
        resolve(true);
      }
    }, 1000); // Check the array every 1000ms

    const failureTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, timeout);
  });
}

/**
 * Waits for an array to have a length greater than or equal to the given number, or times out.
 */
export function waitForArrayLengthToBe<T>(array: T[], length: number, timeout = 60000) {
  return new Promise<boolean>((resolve) => {
    if (array.length >= length) resolve(true);

    const checkInterval = setInterval(() => {
      if (array.length >= length) {
        clearInterval(checkInterval);
        clearTimeout(failureTimeout);
        resolve(true);
      }
    }, 1000); // Check the array every 1000ms

    const failureTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, timeout);
  });
}

/**
 * Waits for an array to contain the given expression, or times out.
 */
export function waitForArrayToContain<T>(array: T[], expression: (item: T) => boolean, timeout = 30000) {
  return new Promise<boolean>((resolve) => {
    if (array.length > 0 && array.some(expression)) resolve(true);

    const checkInterval = setInterval(() => {
      if (array.length > 0 && array.some(expression)) {
        clearInterval(checkInterval);
        clearTimeout(failureTimeout);
        resolve(true);
      }
    }, 500); // Check the array every 500ms

    const failureTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, timeout);
  });
}

/**
 * Sleeps for a given number of milliseconds.
 * This is useful when testing and for waiting for asynchronous operations to complete.
 */
export async function sleep(milliseconds: number = 1000, numberOfTimes: number = 1): Promise<void> {
  // If the number of times is 1, and the milliseconds is greater than 1000, then we want to divide the sleep into smaller chunks
  // Divide into chunks of 250ms
  if (numberOfTimes === 1 && milliseconds > 1000) {
    numberOfTimes = Math.ceil(milliseconds / 250);
    milliseconds = 250;
  }
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

export function getClsServiceOrDefault(instance?: ClsService): ClsService {
  if (!instance) {
    // See https://papooch.github.io/nestjs-cls/features-and-use-cases/breakin-out-of-di
    return ClsServiceManager.getClsService();
  }
  return instance;
}

export function describeWithContext(
  description: string,
  clsService: ClsService,
  tests: (clsService: ClsService) => void,
) {
  describe(description, () => {
    // Initialize clsService immediately if it's not provided
    let localClsService = clsService || ClsServiceManager.getClsService();

    // Wrap the entire test suite with the context
    localClsService.run(async () => {
      localClsService.setIfUndefined<any>(CLS_ID, randomUUID());
      localClsService.setIfUndefined<any>(DAPR_CORRELATION_ID_KEY, randomUUID());

      // Define the tests inside the context
      tests(localClsService);
    });
  });
}

export function itWithContext(description: string, clsService: ClsService, fn: (clsService: ClsService) => void) {
  if (!clsService) clsService = getClsServiceOrDefault(clsService);

  it(description, async () => {
    await clsService.run(async () => {
      clsService.setIfUndefined<any>(CLS_ID, randomUUID());
      clsService.setIfUndefined<any>(DAPR_CORRELATION_ID_KEY, randomUUID());
      await fn(clsService);
    });
  });
}

export function itWithContextOf(
  description: string,
  clsService: ClsService,
  context: ClsStore | any,
  fn: (clsService: ClsService) => void,
) {
  if (!clsService) clsService = getClsServiceOrDefault(clsService);

  it(description, async () => {
    await clsService.runWith(context, async () => {
      clsService.setIfUndefined<any>(CLS_ID, randomUUID());
      clsService.setIfUndefined<any>(DAPR_CORRELATION_ID_KEY, randomUUID());
      await fn(clsService);
    });
  });
}
