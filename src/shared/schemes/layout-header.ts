/**
 * Describes a single header/field used by a layout or mapping configuration.
 *
 * This type captures the different ways a header can be identified, displayed,
 * and validated within the system.
 */
export type LayoutHeader = {
  /** Primary key name used to identify the header in data and mappings. */
  key: string;

  /** User-facing label shown in UIs and reports. */
  label: string;

  /**
   * Alternative names that may appear in incoming data sources.
   * These allow forgiving matching for headers with different naming.
   */
  alternativeKeys?: string[];

  /**
   * Whether header matching is case-sensitive.
   * If false, matching should be performed case-insensitively.
   */
  caseSensitive?: boolean;

  /** Short description explaining the header purpose for maintainers or tooltips. */
  description?: string;

  /** Optional example value to illustrate expected content or format. */
  example?: string;

  /** Whether this header is required for processing. Defaults to false if omitted. */
  required?: boolean;

  /** Optional default value to use when the header is missing or empty. */
  default?: string;
};
