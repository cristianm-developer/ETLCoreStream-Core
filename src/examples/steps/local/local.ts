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

export const LocalStepFnsExample = {
  transforms: (headerKey: string) => {
    return {
      trim: () => trim(headerKey),
      toUpperCase: () => toUpperCase(headerKey),
      toLowerCase: () => toLowerCase(headerKey),
      extractDigits: () => extractDigits(headerKey),
      clear: () => clear(headerKey),
      boolResult: () => boolResult(headerKey, (value: string, row: any) => value === "true"),
      diccTransform: () => diccTransform(headerKey, { true: "1", false: "0" }),
    };
  },
  validators: (headerKey: string, errorCode?: string) => {
    return {
      notNull: () => notNull(headerKey, errorCode),
      onlyNumeric: () => onlyNumeric(headerKey, errorCode),
      regex: (regexPattern: string) => regex(headerKey, regexPattern, errorCode),
      minLength: (minLengthValue: number) => minLength(headerKey, minLengthValue, errorCode),
      maxLength: (maxLengthValue: number) => maxLength(headerKey, maxLengthValue, errorCode),
      minValue: (minValueValue: number) => minValue(headerKey, minValueValue, errorCode),
      maxValue: (maxValueValue: number) => maxValue(headerKey, maxValueValue, errorCode),
      notEmpty: () => notEmpty(headerKey, errorCode),
      inRange: (minValue: number, maxValue: number) =>
        inRange(headerKey, minValue, maxValue, errorCode),
      inList: (list: string[]) => inList(headerKey, list, errorCode),
      notNegative: () => notNegative(headerKey, errorCode),
    };
  },
};
