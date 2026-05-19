import type { RowObject } from "./row-object";

/**
 * Descriptor for a transform that runs at the global step level.
 *
 * A global transform receives all rows and may mutate them in-place.
 * Transforms are expected to be asynchronous and should resolve when complete.
 */
export type GlobalStepTransform = {
  /**
   * Unique name for the transform. Used for logging and identification.
   */
  name: string;
  /**
   * Asynchronous function that performs the transform.
   * @param rows - array of RowObject to transform (mutations should be done in-place)
   * @param args - optional additional arguments from step configuration
   * @returns Promise that resolves when the transform finishes
   */
  fn: (rows: RowObject[], ...args: any[]) => Promise<void>;
  /**
   * Optional static arguments to pass to the transform function.
   */
  args?: any[];
};
