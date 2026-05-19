import {
  boolResult,
  clear,
  diccTransform,
  extractDigits,
  toLowerCase,
  toUpperCase,
  trim,
} from "./transforms/local-transforms";
import {
  inList,
  inRange,
  maxLength,
  maxValue,
  minLength,
  minValue,
  notEmpty,
  notNegative,
  notNull,
  onlyNumeric,
  regex,
} from "./validators/local-validators";

/**
 * Example collection of local step function factories.
 *
 * This object provides two factories:
 * - `transforms(headerKey)`: returns transform factories bound to a column header.
 * - `validators(headerKey, errorCode?)`: returns validator factories bound to a column header.
 *
 * The returned factories produce functions that can be used by the steps engine to
 * transform or validate a single column identified by `headerKey`.
 */
export const LocalStepFnsExample = {
  /**
   * Create transform factories bound to the given column header.
   *
   * @param headerKey - The column header / field name to which transforms will be applied.
   * @returns An object with named transform factory functions.
   */
  transforms: (headerKey: string) => {
    return {
      /** Returns a transform that trims leading/trailing whitespace for `headerKey`. */
      trim: () => trim(headerKey),
      /** Returns a transform that converts the value for `headerKey` to upper case. */
      toUpperCase: () => toUpperCase(headerKey),
      /** Returns a transform that converts the value for `headerKey` to lower case. */
      toLowerCase: () => toLowerCase(headerKey),
      /** Returns a transform that extracts digits from the value of `headerKey`. */
      extractDigits: () => extractDigits(headerKey),
      /** Returns a transform that clears or resets the value for `headerKey`. */
      clear: () => clear(headerKey),
      /**
       * Returns a boolean-result transform for `headerKey`.
       *
       * The provided predicate maps the raw string to a boolean; here it treats
       * the literal string "true" as true.
       */
      boolResult: () => boolResult(headerKey, (value: string, row: any) => value === "true"),
      /**
       * Returns a dictionary-based transform for `headerKey` that maps values
       * according to the given dictionary (example maps "true" -> "1", "false" -> "0").
       */
      diccTransform: () => diccTransform(headerKey, { true: "1", false: "0" }),
    };
  },
  /**
   * Create validator factories bound to the given column header.
   *
   * @param headerKey - The column header / field name to which validators will apply.
   * @param errorCode - Optional error code to use when a validation fails.
   * @returns An object with named validator factory functions.
   */
  validators: (headerKey: string, errorCode?: string) => {
    return {
      /** Returns a validator that fails if the value for `headerKey` is null or undefined. */
      notNull: () => notNull(headerKey, errorCode),
      /** Returns a validator that ensures the value for `headerKey` contains only numeric characters. */
      onlyNumeric: () => onlyNumeric(headerKey, errorCode),
      /**
       * Returns a validator that checks the value of `headerKey` against a regular expression.
       *
       * @param regexPattern - The regular expression pattern to test the value against.
       */
      regex: (regexPattern: string) => regex(headerKey, regexPattern, errorCode),
      /**
       * Returns a validator that enforces a minimum string length for `headerKey`.
       *
       * @param minLengthValue - Minimum allowed length (inclusive).
       */
      minLength: (minLengthValue: number) => minLength(headerKey, minLengthValue, errorCode),
      /**
       * Returns a validator that enforces a maximum string length for `headerKey`.
       *
       * @param maxLengthValue - Maximum allowed length (inclusive).
       */
      maxLength: (maxLengthValue: number) => maxLength(headerKey, maxLengthValue, errorCode),
      /**
       * Returns a validator that enforces a minimum numeric value for `headerKey`.
       *
       * @param minValueValue - Minimum allowed numeric value (inclusive).
       */
      minValue: (minValueValue: number) => minValue(headerKey, minValueValue, errorCode),
      /**
       * Returns a validator that enforces a maximum numeric value for `headerKey`.
       *
       * @param maxValueValue - Maximum allowed numeric value (inclusive).
       */
      maxValue: (maxValueValue: number) => maxValue(headerKey, maxValueValue, errorCode),
      /** Returns a validator that fails if the value for `headerKey` is an empty string. */
      notEmpty: () => notEmpty(headerKey, errorCode),
      /**
       * Returns a validator that checks whether a numeric value is within the given range.
       *
       * @param minValue - Minimum allowed numeric value (inclusive).
       * @param maxValue - Maximum allowed numeric value (inclusive).
       */
      inRange: (minValue: number, maxValue: number) =>
        inRange(headerKey, minValue, maxValue, errorCode),
      /**
       * Returns a validator that checks whether the value for `headerKey` is one of the allowed values.
       *
       * @param list - Array of allowed string values.
       */
      inList: (list: string[]) => inList(headerKey, list, errorCode),
      /** Returns a validator that fails if the numeric value for `headerKey` is negative. */
      notNegative: () => notNegative(headerKey, errorCode),
    };
  },
};
