/*
  An error that can be serialized to JSON, which does not throw a HTTP 500 error.
  This error is useful for operations that may fail, but should not be considered a critical error.
  The status code returned can be set by the caller.
  See: https://learn.microsoft.com/en-us/azure/architecture/best-practices/retry-service-specific
 */
export class SerializableError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}
