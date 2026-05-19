/**
 * Represents a validator executed for a single cell in a local processing step.
 *
 * A validator defines the column it targets and a function that checks the
 * provided value (and optionally the row) returning a structured validation
 * result describing whether the value passed and additional metadata.
 */
export type LocalStepValidator = {
  /**
   * Header key (column identifier) this validator targets.
   */
  headerKey: string;
  /**
   * Descriptive name of the validator (e.g. "Not Null").
   */
  name: string;
  /**
   * Validator function.
   *
   * @param value - cell value as string
   * @param row - the full row object for context
   * @param args - additional optional arguments supplied when the validator is configured
   * @returns object containing validation outcome and optional metadata
   */
  fn: (
    value: string,
    row: any,
    ...args: any[]
  ) => {
    /**
     * Whether the value passed validation.
     */
    isValid: boolean;
    /**
     * A short code identifying the validation result (e.g. "NOT_NULL").
     */
    validationCode: string;
    /**
     * Human-readable message when validation fails (optional).
     */
    message?: string;
    /**
     * Optional normalized or extracted value returned by the validator.
     */
    value?: any;
  };
  /**
   * Optional arguments that will be passed to `fn` when executed.
   */
  args?: any[];
  /**
   * Optional error code to attach to the validator definition (may be used by the pipeline).
   */
  errorCode?: string;
};

export type ValidationError = {
  /**
   * Internal row identifier (index) where the error occurred.
   */
  __rowId: number;
  /**
   * Header key (column) related to the error.
   */
  headerKey: string;
  /**
   * Validation code identifying the failure (e.g. "NOT_NULL").
   */
  validationCode: string;
  /**
   * Human-friendly error message (optional).
   */
  message?: string;
  /**
   * Optional object describing the value after validation or normalization.
   */
  value?: Record<string, any>;
  /**
   * Original raw value prior to normalization (optional).
   */
  originalValue?: Record<string, any>;
};
