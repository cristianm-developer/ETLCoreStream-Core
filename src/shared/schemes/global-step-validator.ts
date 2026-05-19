import type { ValidationError } from "./local-step-validators";
import type { RowObject } from "./row-object";

/**
 * Descriptor for a validator that runs at the global step level.
 *
 * A global validator receives all rows in the current chunk (or dataset) and
 * must return a list of validation errors and a list of row indexes whose
 * previous validation errors should be removed.
 */
export type GlobalStepValidator = {
  /**
   * Unique name for the validator. Used for logging and identifying the step.
   */
  name: string;
  /**
   * Asynchronous function executed for this validator.
   * @param rows - array of RowObject to validate
   * @param args - any additional arguments passed from the step configuration
   * @returns Promise resolving to an object with `validationErrors` and `removedValidationErrors`.
   */
  fn: (
    rows: RowObject[],
    ...args: any[]
  ) => Promise<{
    /**
     * Array of ValidationError objects produced by the validator.
     */
    validationErrors: ValidationError[];
    /**
     * Array of row indexes (numbers) whose existing validation error flag should be cleared.
     */
    removedValidationErrors: number[];
  }>;
  /**
   * Optional static arguments to be forwarded to the `fn` when executed.
   */
  args?: any[];
  /**
   * Optional error code to assign to every validation error returned by this validator.
   * When set, the engine will overwrite each error's `validationCode` with this value.
   */
  errorCode?: string;
};
