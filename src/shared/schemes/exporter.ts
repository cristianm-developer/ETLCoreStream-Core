/**
 * RowObject represents the internal shape of a row processed by the system.
 * It typically contains the parsed `value` object and internal metadata fields.
 */
import type { RowObject } from "./row-object";

/**
 * Definition of an exporter configuration.
 *
 * Exporters transform an internal `RowObject` into a plain object suitable
 * for downstream output (CSV, JSON, external APIs, etc.) and can optionally
 * provide labels and a post-processing callback that consumes the output stream.
 */
export type Exporter = {
  /**
   * Internal or unique name for the exporter.
   */
  name: string;

  /**
   * Optional longer description explaining what the exporter produces
   * and any special behaviors it performs.
   */
  description?: string;

  /**
   * Optional short label used in UIs to represent this exporter.
   */
  label?: string;

  /**
   * Function that receives a `RowObject` and returns a plain record
   * containing the fields to be exported. Returning `null` or `undefined`
   * can be used to skip the row (implementation may accept this).
   */
  fn: (row: RowObject) => Record<string, any> | null | undefined;

  /**
   * Optional dictionary mapping exported keys to human-friendly column labels.
   * Keys are the object keys produced by `fn`, values are the displayed header.
   */
  labelDicc?: Record<string, string>;

  /**
   * Optional callback that receives the resulting ReadableStream of exported
   * records. Useful for aggregation, streaming to files, or sending the stream
   * to external services. The callback should resolve when processing completes.
   */
  callback?: (stream: ReadableStream) => Promise<void>;
};
