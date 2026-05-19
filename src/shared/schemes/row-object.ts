/**
 * Representation of a single row in the system, including metadata and current values.
 */
export type RowObject = {
  /** Internal unique numeric identifier for the row. */
  __rowId: number;
  /** Optional original/raw values for the row before any transformations. */
  __originalValue?: Record<string, any>;
  /** Optional error message or code associated with this row, or null when no error. */
  __isError?: string | null;
  /** The current, possibly transformed, key–value data for this row. */
  value: Record<string, any>;
};
