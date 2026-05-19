/**
 * Filter used to query items by row id ranges or explicit sets.
 *
 * - `fromRowId` and `toRowId` define an inclusive numeric interval.
 * - `rowIdIn` narrows the query to an explicit list of row ids.
 */
export type ErrorFilter = {
  /**
   * Lower bound (inclusive) for row id selection.
   */
  fromRowId?: number;
  /**
   * Upper bound (inclusive) for row id selection.
   */
  toRowId?: number;
  /**
   * Explicit list of row ids to include.
   */
  rowIdIn?: number[];
};

/**
 * Comprehensive row filter combining error-range filters with content predicates.
 *
 * - `withErrors`/`withoutErrors` allow filtering rows by error presence.
 * - `fields` contains per-field predicates evaluated against row values.
 */
export type RowFilter = {
  /**
   * When true, only rows that currently have an error flag are returned.
   */
  withErrors?: boolean;
  /**
   * When true, only rows that do NOT have an error flag are returned.
   */
  withoutErrors?: boolean;
  /**
   * Array of field filters applied conjunctively (all must match).
   */
  fields?: RowFilteredField[];
} & ErrorFilter;

/**
 * Predicate applied to a single field (column) of a row.
 *
 * - `headerKey` selects the field by its header key.
 * - `operator` chooses how the field value is compared to `value`.
 * - `value` is the right-hand operand used for comparison (ignored for some operators).
 */
export type RowFilteredField = {
  /**
   * The header key (column name) to evaluate on the row object.
   */
  headerKey: string;
  /**
   * Comparison operator. Supported operators:
   * "=" | "!=" | ">" | "<" | ">=" | "<=" |
   * "includes" | "notIncludes" | "startsWith" | "endsWith" |
   * "isEmpty" | "isNotEmpty" |
   * "regex" | "notRegex" |
   * "isTrue" | "isFalse" |
   * "isNotNull" | "isNullish" | "isDefined" | "isNumber"
   */
  operator:
    | "="
    | "!="
    | ">"
    | "<"
    | ">="
    | "<="
    | "includes"
    | "notIncludes"
    | "startsWith"
    | "endsWith"
    | "isEmpty"
    | "isNotEmpty"
    | "regex"
    | "notRegex"
    | "isTrue"
    | "isFalse"
    | "isNotNull"
    | "isNullish"
    | "isDefined"
    | "isNumber";
  /**
   * Value used by the operator for comparison. Type depends on operator:
   * string for text comparisons, RegExp pattern string for `regex`/`notRegex`,
   * number for numeric comparisons, or ignored for null/emptiness checks.
   */
  value: any;
};
