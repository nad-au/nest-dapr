import { SetMetadata } from '@nestjs/common';
import { DAPR_BINDING_METADATA } from './constants';

/**
 * `@DaprBinding` decorator metadata
 */
export interface DaprBindingMetadata {
  /**
   * Name of binding to receive data.
   */
  name: string;
}

/**
 * Dapr Binding decorator.
 * Receives data from Dapr input bindings.
 *
 * @param name name of binding
 */
export const DaprBinding = (name: string): MethodDecorator =>
  SetMetadata(DAPR_BINDING_METADATA, { name } as DaprBindingMetadata);
