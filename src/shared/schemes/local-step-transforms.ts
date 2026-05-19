/**
 * Represents a local transformation applied to a single cell value.
 *
 * Each transform targets a specific column (headerKey) and provides a
 * function that receives the current cell value and the full row for context,
 * returning a new string value to be stored in that cell.
 */
export type LocalStepTransform = {
  /**
   * The header key (column identifier) this transform targets.
   */
  headerKey: string;
  /**
   * The short, human-readable name of the transform (e.g. "toUpperCase").
   */
  name: string;
  /**
   * Transformation function.
   *
   * @param value - original cell value as string
   * @param row - the full row object for context
   * @param args - additional optional arguments supplied when the transform is configured
   * @returns transformed value as string
   */
  fn: (value: string, row: any, ...args: any[]) => string;
  /**
   * Optional arguments that will be passed to `fn` when executed.
   */
  args?: any[];
};
